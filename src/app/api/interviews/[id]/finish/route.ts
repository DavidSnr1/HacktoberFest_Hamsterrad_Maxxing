import { after } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson } from "@/lib/api";
import { awardXp, XP_REWARDS } from "@/lib/gamification/xp";
import { generateAndStoreFeedback } from "@/lib/interview/feedback";
import { finishInterviewSchema } from "@/lib/schemas/interview";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

// Feedback is generated after the response (see `after` below). The quality
// model takes 1-3 minutes; the function must stay alive for that long.
export const maxDuration = 300;

export type FinishInterviewResponse = { status: "finished" | "aborted" };

/**
 * Saves the transcript and closes a running interview. Feedback is created
 * in the background; the feedback page shows a pending state meanwhile.
 * An interview without a single candidate answer is stored as aborted.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/finish">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "Ungültige Anfrage.");

  const parsed = finishInterviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Das Transkript konnte nicht gelesen werden.");

  const { transcript, durationSeconds } = parsed.data;
  const hasAnswers = transcript.some((entry) => entry.role === "candidate");
  const status = parsed.data.status === "finished" && hasAnswers ? "finished" : "aborted";

  // Only running interviews can be closed; RLS limits this to the user's own.
  const { data: interview, error } = await supabase
    .from("interviews")
    .update({
      status,
      transcript,
      duration_seconds: durationSeconds,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .eq("status", "running")
    .select("id, user_id, track, transcript, duration_seconds")
    .maybeSingle();

  if (error) {
    return apiError(500, "Das Transkript konnte nicht gespeichert werden. Bitte versuche es erneut.");
  }
  if (!interview) return apiError(409, "Dieses Interview ist bereits beendet.");

  if (status === "finished") {
    await awardXp(user.id, "interview_finished", XP_REWARDS.interviewFinished, interview.id);
    after(() => generateAndStoreFeedback(interview));
  }
  return apiOk<FinishInterviewResponse>({ status });
}
