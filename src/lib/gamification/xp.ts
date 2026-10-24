import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type { XpEventType } from "./xp-labels";

export type { XpEventType };

/** XP per activity. Milestone amounts live in milestones.ts, the level curve in levels.ts. */
export const XP_REWARDS = {
  interviewFinished: 100,
  /** Per point of the overall feedback score (1-5), so 20-100 XP. */
  feedbackScorePerPoint: 20,
  resumeUploaded: 50,
  experienceRecorded: 30,
  resumeTailored: 80,
  /** Finishing the onboarding chat (once per user). */
  profileCompleted: 50,
  /** Once per calendar day (Europe/Berlin) with at least one other XP event. */
  dailyStreak: 10,
  /** Bonus for an interview whose overall feedback score is above INTERVIEW_BONUS_MIN_SCORE. */
  interviewBonus: 40,
} as const;

/** The bonus needs a score strictly above this (the prototype's "über 7/10"). */
export const INTERVIEW_BONUS_MIN_SCORE = 3.5;

export function feedbackScoreXp(overall: number) {
  return Math.round(overall * XP_REWARDS.feedbackScorePerPoint);
}

/**
 * Records an XP event. Idempotent per (user, type, refId): a unique index
 * rejects duplicates, which is treated as success. Every awarded activity
 * also counts as the day's streak event.
 */
export async function awardXp(userId: string, type: XpEventType, amount: number, refId: string) {
  const admin = createAdminClient();
  if (!admin || amount <= 0) return false;

  const { error } = await admin
    .from("xp_events")
    .insert({ user_id: userId, type, amount, ref_id: refId });

  // 23505 = unique_violation: already awarded.
  if (error && error.code !== "23505") return false;

  if (type !== "daily_streak") {
    // One per day, enforced by xp_events_daily_streak_day_key; a duplicate is expected.
    const { error: streakError } = await admin
      .from("xp_events")
      .insert({ user_id: userId, type: "daily_streak", amount: XP_REWARDS.dailyStreak, ref_id: null });
    if (streakError && streakError.code !== "23505") console.error("xp: streak award failed", streakError.code);
  }
  return true;
}
