import type { Enums } from "@/lib/supabase/database.types";
import { milestoneByRefId } from "./milestones";

export type XpEventType = Enums<"xp_event_type">;

const TYPE_LABELS: Record<XpEventType, string> = {
  interview_finished: "Mock-Interview abgeschlossen",
  feedback_score: "Feedback-Score",
  interview_bonus: "Stark-Bonus fürs Interview",
  resume_uploaded: "Lebenslauf hochgeladen",
  resume_tailored: "Lebenslauf zugeschnitten",
  experience_recorded: "Erfahrung eingesprochen",
  daily_streak: "Tägliche Streak",
  profile_completed: "Profil vervollständigt",
  milestone: "Meilenstein",
};

/** German label for an XP event in the history list. */
export function xpEventLabel(type: XpEventType, refId: string | null): string {
  if (type === "milestone") {
    const milestone = milestoneByRefId(refId);
    if (milestone) return `Meilenstein: ${milestone.title}`;
  }
  return TYPE_LABELS[type];
}
