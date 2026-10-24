import { z } from "zod";
import { apiError, apiOk, readJson } from "@/lib/api";
import { finishInterviewSchema } from "@/lib/schemas/interview";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type FinishInterviewResponse = { status: "finished" | "aborted" };

/**
 * Saves the transcript and closes a running interview.
 * An interview without a single candidate answer is stored as aborted.
 * Step 4 adds feedback generation here.
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
  const { data, error } = await supabase
    .from("interviews")
    .update({
      status,
      transcript,
      duration_seconds: durationSeconds,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id.data)
    .eq("status", "running")
    .select("id")
    .maybeSingle();

  if (error) {
    return apiError(500, "Das Transkript konnte nicht gespeichert werden. Bitte versuche es erneut.");
  }
  if (!data) return apiError(409, "Dieses Interview ist bereits beendet.");

  return apiOk<FinishInterviewResponse>({ status });
}
