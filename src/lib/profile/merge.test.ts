// Unit tests for the profile merge rules. Run with: npm run test:unit
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { candidateProfileSchema } from "@/lib/schemas/candidate-profile";
import { applyConfirmation, emptyProfile, mergeProfile, profileCompleteness } from "./merge";

let counter = 0;
const newId = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, "0")}`;
const now = new Date("2026-10-24T12:00:00Z");

test("user values are stored as confirmed", () => {
  const p = mergeProfile(emptyProfile(), { basics: { location: "Mannheim" } }, { source: "user", now, newId });
  assert.equal(p.basics.location?.value, "Mannheim");
  assert.equal(p.basics.location?.confirmed, true);
  assert.equal(p.basics.location?.source, "user");
});

test("automatic sources never overwrite user values", () => {
  const user = mergeProfile(emptyProfile(), { basics: { location: "Mannheim" } }, { source: "user", now, newId });
  const auto = mergeProfile(user, { basics: { location: "Berlin" } }, { source: "resume", sourceRef: "r1", now, newId });
  assert.equal(auto.basics.location?.value, "Mannheim");
});

test("automatic values become unconfirmed suggestions and can be replaced by newer suggestions", () => {
  const a = mergeProfile(emptyProfile(), { goals: { earliestStart: "2027-03" } }, { source: "resume", sourceRef: "r1", now, newId });
  assert.equal(a.goals.earliestStart?.confirmed, false);
  assert.equal(a.goals.earliestStart?.sourceRef, "r1");
  const b = mergeProfile(a, { goals: { earliestStart: "2027-04" } }, { source: "resume", sourceRef: "r2", now, newId });
  assert.equal(b.goals.earliestStart?.value, "2027-04");
});

test("confirmed suggestions are protected", () => {
  const a = mergeProfile(emptyProfile(), { goals: { remoteOk: true } }, { source: "resume", now, newId });
  const confirmed = applyConfirmation(a, { section: "goals", field: "remoteOk" }, true, now);
  const b = mergeProfile(confirmed, { goals: { remoteOk: false } }, { source: "resume", now, newId });
  assert.equal(b.goals.remoteOk?.value, true);
});

test("only the user can clear a value", () => {
  const user = mergeProfile(emptyProfile(), { goals: { tracks: ["consulting"] } }, { source: "user", now, newId });
  assert.notEqual(mergeProfile(user, { goals: { tracks: null } }, { source: "resume", now, newId }).goals.tracks, null);
  assert.equal(mergeProfile(user, { goals: { tracks: null } }, { source: "user", now, newId }).goals.tracks, null);
});

test("user list replaces user items, keeps others, confirms re-entered suggestions", () => {
  let p = mergeProfile(emptyProfile(), { skills: ["Excel", "PowerPoint"] }, { source: "user", now, newId });
  p = mergeProfile(p, { skills: ["SQL", "python"] }, { source: "resume", sourceRef: "r1", now, newId });
  const pythonId = p.skills.find((s) => s.value === "python")?.id;
  p = mergeProfile(p, { skills: ["Excel", "Python"] }, { source: "user", now, newId });

  const byValue = Object.fromEntries(p.skills.map((s) => [s.value.toLowerCase(), s]));
  assert.ok(byValue.excel?.confirmed, "Excel stays as user value");
  assert.equal(byValue.powerpoint, undefined, "PowerPoint was removed by the user");
  assert.equal(byValue.sql?.confirmed, false, "SQL suggestion stays untouched");
  assert.equal(byValue.python?.confirmed, true, "re-entered suggestion becomes confirmed");
  assert.equal(byValue.python?.id, pythonId, "and keeps its id");
});

test("automatic lists only add new items (case-insensitive)", () => {
  let p = mergeProfile(emptyProfile(), { languages: [{ language: "Englisch", level: "C1" }] }, { source: "user", now, newId });
  p = mergeProfile(
    p,
    { languages: [{ language: "englisch", level: "B2" }, { language: "Französisch", level: "B1" }] },
    { source: "resume", now, newId },
  );
  assert.equal(p.languages.length, 2);
  assert.equal(p.languages.find((l) => l.value.language === "Englisch")?.value.level, "C1");
});

test("rejecting removes a list item or clears a scalar", () => {
  let p = mergeProfile(emptyProfile(), { skills: ["SQL"] }, { source: "resume", now, newId });
  p = applyConfirmation(p, { list: "skills", id: p.skills[0].id }, false, now);
  assert.equal(p.skills.length, 0);
  p = mergeProfile(p, { basics: { location: "Köln" } }, { source: "resume", now, newId });
  p = applyConfirmation(p, { section: "basics", field: "location" }, false, now);
  assert.equal(p.basics.location, null);
});

test("merged profiles stay valid against the schema", () => {
  const p = mergeProfile(
    emptyProfile(),
    {
      basics: { location: "Mannheim" },
      education: [{ institution: "Uni Mannheim", degree: "master", field: "BWL", semester: 2, expectedGraduation: "2027-09" }],
      skills: ["Excel"],
      languages: [{ language: "Deutsch", level: "native" }],
      goals: { tracks: ["consulting"], employmentTypes: ["internship"], preferredLocations: ["München"], remoteOk: true, earliestStart: "2027-03" },
    },
    { source: "user", now },
  );
  assert.ok(candidateProfileSchema.safeParse(p).success);
  assert.equal(profileCompleteness(p), 1);
  assert.equal(profileCompleteness(emptyProfile()), 0);
});

test("the example file for the team matches the schema", () => {
  const example = JSON.parse(readFileSync("docs/candidate-profile.example.json", "utf8"));
  const result = candidateProfileSchema.safeParse(example);
  assert.ok(result.success, result.success ? "" : JSON.stringify(result.error.issues.slice(0, 3)));
});
