import "server-only";
import type { Enums } from "@/lib/supabase/database.types";
import { createAdminClient } from "@/lib/supabase/admin";

export type XpEventType = Enums<"xp_event_type">;

/** XP per activity. Level curve, badges and streaks follow in step 7. */
export const XP_REWARDS = {
  interviewFinished: 100,
  /** Per point of the overall feedback score (1-5), so 20-100 XP. */
  feedbackScorePerPoint: 20,
} as const;

export function feedbackScoreXp(overall: number) {
  return Math.round(overall * XP_REWARDS.feedbackScorePerPoint);
}

/**
 * Records an XP event. Idempotent per (user, type, refId): a unique index
 * rejects duplicates, which is treated as success.
 */
export async function awardXp(userId: string, type: XpEventType, amount: number, refId: string) {
  const admin = createAdminClient();
  if (!admin || amount <= 0) return false;

  const { error } = await admin
    .from("xp_events")
    .insert({ user_id: userId, type, amount, ref_id: refId });

  // 23505 = unique_violation: already awarded.
  return !error || error.code === "23505";
}
