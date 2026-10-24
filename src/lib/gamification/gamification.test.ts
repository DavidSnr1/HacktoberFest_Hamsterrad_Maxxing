import assert from "node:assert/strict";
import { test } from "node:test";
import { emptyProfile } from "@/lib/profile/merge";
import type { CandidateProfile, ExperienceValue } from "@/lib/schemas/candidate-profile";
import { levelFromXp, levelProgress } from "./levels";
import { profileMilestones } from "./milestones";
import { computeStreak } from "./streak";

test("levels follow the thresholds 0 / 201 / 501 / 1001 / 1801", () => {
  assert.equal(levelFromXp(0), 1);
  assert.equal(levelFromXp(200), 1);
  assert.equal(levelFromXp(201), 2);
  assert.equal(levelFromXp(1000), 3);
  assert.equal(levelFromXp(1001), 4);
  assert.equal(levelFromXp(99999), 5);
});

test("progress within a level and at the maximum", () => {
  assert.deepEqual(levelProgress(351), { level: 2, xp: 351, levelStartXp: 201, nextLevelXp: 501, percent: 50 });
  assert.equal(levelProgress(2000).nextLevelXp, null);
  assert.equal(levelProgress(2000).percent, 100);
});

test("streak counts Berlin days and survives a day without activity yet", () => {
  // 23:30 UTC on 1 Oct is already 2 Oct in Berlin.
  const events = ["2026-10-01T23:30:00Z", "2026-10-03T08:00:00Z", "2026-10-04T08:00:00Z"];
  const now = new Date("2026-10-05T10:00:00Z");
  assert.deepEqual(computeStreak(events, now), { current: 3, longest: 3, activeToday: false });
  assert.deepEqual(computeStreak(events, new Date("2026-10-06T10:00:00Z")), {
    current: 0,
    longest: 3,
    activeToday: false,
  });
});

const meta = { source: "user" as const, sourceRef: null, confirmed: true, updatedAt: "2026-10-01T00:00:00.000Z" };

function profileWith(experience: Partial<ExperienceValue>[], degrees: ("bachelor" | "master")[] = []): CandidateProfile {
  const profile = emptyProfile();
  profile.education = degrees.map((degree, i) => ({
    id: `00000000-0000-4000-8000-00000000000${i}`,
    value: { institution: "Uni", degree, field: "BWL", semester: null, expectedGraduation: null },
    ...meta,
  }));
  profile.experience = experience.map((value, i) => ({
    id: `00000000-0000-4000-8000-00000000001${i}`,
    value: { organization: "Firma", role: "Praktikum", type: "internship", location: null, start: null, end: null, details: [], ...value },
    ...meta,
  }));
  return profile;
}

test("milestones come from degrees and internships of three months or more", () => {
  const now = new Date("2026-10-15T00:00:00Z");
  assert.deepEqual([...profileMilestones(profileWith([], ["bachelor"]), now)], ["bachelor"]);
  assert.ok(!profileMilestones(profileWith([{ start: "2026-01", end: "2026-02" }]), now).has("internship"));
  assert.ok(profileMilestones(profileWith([{ start: "2026-01", end: "2026-03" }]), now).has("internship"));
  // Ongoing since August: August to October are three months.
  assert.ok(profileMilestones(profileWith([{ start: "2026-08", end: null }]), now).has("internship"));
  const unconfirmed = profileWith([], ["master"]);
  unconfirmed.education[0].confirmed = false;
  assert.equal(profileMilestones(unconfirmed, now).size, 0);
  assert.ok(!profileMilestones(profileWith([{ type: "working_student", start: "2025-01", end: "2026-01" }]), now).has("internship"));
});
