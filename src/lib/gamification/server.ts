import "server-only";
import { cache } from "react";
import { getCandidateProfileRecord } from "@/lib/profile/server";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { BADGES, type Badge } from "./badges";
import { levelProgress, type Level, type LevelProgress } from "./levels";
import { MILESTONES, profileMilestones, type Milestone } from "./milestones";
import { vibeFromTracks, type Vibe } from "./personas";
import { computeStreak, type StreakInfo } from "./streak";
import { awardXp, XP_REWARDS } from "./xp";
import type { XpEventType } from "./xp-labels";

export type XpEvent = { type: XpEventType; amount: number; refId: string | null; createdAt: string };

export type CharacterState = {
  progress: LevelProgress;
  vibe: Vibe;
  /** False if the profile has no track yet (the vibe is then the default). */
  vibeFromProfile: boolean;
  streak: StreakInfo;
  milestones: (Milestone & { reached: boolean })[];
  badges: (Omit<Badge, "earned"> & { earned: boolean })[];
  counts: { interviews: number; interviewBonuses: number; resumesTailored: number };
  recentEvents: XpEvent[];
  /** Null until the page was opened once. */
  lastSeenLevel: Level | null;
};

export type CharacterResult = { kind: "ok"; state: CharacterState } | { kind: "error" } | { kind: "signed_out" };

/**
 * Reads the user's XP events. PostgREST returns at most 1000 rows, which is
 * far above what one user collects (at most one streak event per day).
 */
async function readEvents(): Promise<XpEvent[] | null> {
  const supabase = await createClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("xp_events")
    .select("type, amount, ref_id, created_at")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) {
    console.error("character: reading xp events failed", error.code);
    return null;
  }
  return data.map((e) => ({ type: e.type, amount: e.amount, refId: e.ref_id, createdAt: e.created_at }));
}

/** Total XP and level of the signed-in user; null on errors. */
export async function getCurrentLevel(): Promise<Level | null> {
  const events = await readEvents();
  return events && levelProgress(events.reduce((sum, e) => sum + e.amount, 0)).level;
}

/**
 * Everything the character page shows. Milestones the profile proves are
 * awarded here, so they appear without a separate trigger.
 */
export const getCharacterState = cache(async (): Promise<CharacterResult> => {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return { kind: "signed_out" };

  const [events, record, interviewsResult, profileResult] = await Promise.all([
    readEvents(),
    getCandidateProfileRecord(),
    supabase.from("interviews").select("track").eq("status", "finished"),
    supabase.from("profiles").select("last_seen_level").eq("id", user.id).maybeSingle(),
  ]);
  if (!events || interviewsResult.error) return { kind: "error" };

  const profile = record?.profile;
  const awarded = new Set(events.filter((e) => e.type === "milestone").map((e) => e.refId));
  if (profile) {
    const reached = profileMilestones(profile);
    const missing = MILESTONES.filter((m) => reached.has(m.id) && !awarded.has(m.refId));
    for (const milestone of missing) {
      if (await awardXp(user.id, "milestone", milestone.xp, milestone.refId)) {
        events.unshift({ type: "milestone", amount: milestone.xp, refId: milestone.refId, createdAt: new Date().toISOString() });
        awarded.add(milestone.refId);
      }
    }
  }

  const totalXp = events.reduce((sum, e) => sum + e.amount, 0);
  const streak = computeStreak(events.map((e) => e.createdAt));
  const eventTypes = new Set(events.map((e) => e.type));
  const feedbackScores = events.filter((e) => e.type === "feedback_score").map((e) => e.amount / XP_REWARDS.feedbackScorePerPoint);
  const stats = {
    eventTypes,
    bestFeedbackScore: feedbackScores.length ? Math.max(...feedbackScores) : null,
    finishedTracks: new Set(interviewsResult.data.map((i) => i.track)).size,
    longestStreak: streak.longest,
  };
  const tracks = profile?.goals.tracks?.value;
  const lastSeen = profileResult.data?.last_seen_level;

  return {
    kind: "ok",
    state: {
      progress: levelProgress(totalXp),
      vibe: vibeFromTracks(tracks),
      vibeFromProfile: Boolean(tracks?.length),
      streak,
      milestones: MILESTONES.map((m) => ({ ...m, reached: awarded.has(m.refId) })),
      badges: BADGES.map(({ earned, ...badge }) => ({ ...badge, earned: earned(stats) })),
      counts: {
        interviews: events.filter((e) => e.type === "interview_finished").length,
        interviewBonuses: events.filter((e) => e.type === "interview_bonus").length,
        resumesTailored: events.filter((e) => e.type === "resume_tailored").length,
      },
      recentEvents: events.slice(0, 8),
      lastSeenLevel: lastSeen ? (lastSeen as Level) : null,
    },
  };
});
