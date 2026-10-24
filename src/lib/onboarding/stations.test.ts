import assert from "node:assert/strict";
import { test } from "node:test";
import { buildStation, EMPTY_STATION_DRAFT, isBlankDraft, parseDetails, stationFromValue } from "./stations";

const draft = (patch: Partial<typeof EMPTY_STATION_DRAFT>) => ({ ...EMPTY_STATION_DRAFT, ...patch });

test("details: one point per line, list markers removed", () => {
  assert.deepEqual(parseDetails("- Reporting aufgebaut\n\n• Forecasts erstellt \n* Team geführt"), [
    "Reporting aufgebaut",
    "Forecasts erstellt",
    "Team geführt",
  ]);
});

test("an ongoing experience becomes a profile value without end", () => {
  const result = buildStation(
    "experience",
    draft({
      title: "Werkstudent Controlling",
      place: "SAP SE",
      type: "working_student",
      start: { month: "10", year: "2025" },
      ongoing: true,
      details: "Reporting automatisiert",
    }),
  );
  assert.ok(result.ok);
  assert.deepEqual(result.entry.value, {
    organization: "SAP SE",
    role: "Werkstudent Controlling",
    type: "working_student",
    location: null,
    start: "2025-10",
    end: null,
    details: ["Reporting automatisiert"],
  });
  assert.equal(result.entry.text, "Werkstudent Controlling bei SAP SE, Werkstudent (10/2025 – heute)");
});

test("incomplete or contradictory dates are explained", () => {
  const base = { title: "Praktikant", place: "Bosch" };
  const problemOf = (patch: Partial<typeof EMPTY_STATION_DRAFT>) => {
    const result = buildStation("experience", draft({ ...base, ...patch }));
    return result.ok ? null : result.problem;
  };
  assert.match(problemOf({})!, /seit wann/);
  assert.match(problemOf({ start: { month: "03", year: "" } })!, /Monat und Jahr/);
  assert.match(problemOf({ start: { month: "03", year: "2025" } })!, /läuft noch/);
  assert.match(problemOf({ start: { month: "03", year: "2025" }, end: { month: "01", year: "2025" } })!, /vor dem Start/);
  assert.equal(problemOf({ start: { month: "03", year: "2025" }, end: { month: "08", year: "2025" } }), null);
});

test("projects need no dates, but a name", () => {
  assert.ok(buildStation("projects", draft({ title: "Hackathon-App" })).ok);
  assert.ok(!buildStation("projects", draft({ place: "privat" })).ok);
});

test("a stored value round-trips through the form", () => {
  const value = { organization: "Fachschaft", role: "Vorstand Finanzen", start: "2025-04", end: null, details: ["Budget verwaltet"] };
  const entry = stationFromValue("volunteering", value);
  assert.ok(entry);
  assert.equal(entry.draft.ongoing, true);
  const rebuilt = buildStation("volunteering", entry.draft);
  assert.ok(rebuilt.ok);
  assert.deepEqual(rebuilt.entry.value, value);
  assert.equal(stationFromValue("volunteering", { role: "ohne Organisation" }), null);
});

test("a blank form is recognised", () => {
  assert.ok(isBlankDraft(EMPTY_STATION_DRAFT));
  assert.ok(!isBlankDraft(draft({ ongoing: true })));
});
