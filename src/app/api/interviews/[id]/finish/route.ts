import { after } from "next/server";
import { z } from "zod";
import { apiError, apiOk, readJson } from "@/lib/api";
import { awardXp, XP_REWARDS } from "@/lib/gamification/xp";
import { generateAndStoreFeedback } from "@/lib/interview/feedback";
import { finishInterviewSchema, transcriptSchema } from "@/lib/schemas/interview";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

// Feedback is generated after the response (see `after` below). The quality
// model takes 1-3 minutes; the function must stay alive for that long.
export const maxDuration = 300;

export type FinishInterviewResponse = { status: "finished" | "aborted" };

/**
 * Closes a running interview. The answers are already stored by the answers
 * route; an interview without any answer is stored as aborted. Feedback is
 * created in the background while the feedback page shows a pending state.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/finish">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "Ungültige Anfrage.");

  const parsed = finishInterviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Ungültige Anfrage.");

  // RLS limits this to the user's own interviews.
  const { data: current } = await supabase
    .from("interviews")
    .select("status, started_at, transcript")
    .eq("id", id.data)
    .maybeSingle();
  if (!current) return apiError(404, "Interview nicht gefunden.");
  if (current.status !== "running") return apiError(409, "Dieses Interview ist bereits beendet.");

  const transcript = transcriptSchema.safeParse(current.transcript);
  const hasAnswers = transcript.success && transcript.data.some((e) => e.role === "candidate");
  const status = parsed.data.status === "finished" && hasAnswers ? "finished" : "aborted";
  const finishedAt = new Date();
  const durationSeconds = Math.max(
    0,
    Math.round((finishedAt.getTime() - new Date(current.started_at).getTime()) / 1000),
  );

  const { data: interview, error } = await supabase
    .from("interviews")
    .update({ status, duration_seconds: durationSeconds, finished_at: finishedAt.toISOString() })
    .eq("id", id.data)
    .eq("status", "running")
    .select("id, user_id, track, transcript, duration_seconds")
    .maybeSingle();

  if (error) return apiError(500, "Das Interview konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
  if (!interview) return apiError(409, "Dieses Interview ist bereits beendet.");

  if (status === "finished") {
    await awardXp(user.id, "interview_finished", XP_REWARDS.interviewFinished, interview.id);
    after(() => generateAndStoreFeedback(interview));
  }
  return apiOk<FinishInterviewResponse>({ status });
}
