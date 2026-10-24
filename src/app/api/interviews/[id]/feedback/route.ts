import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { generateAndStoreFeedback, type FeedbackOutcome } from "@/lib/interview/feedback";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 300;

export type GenerateFeedbackResponse = { feedback: FeedbackOutcome["kind"] };

const FAILURE_MESSAGES: Record<Extract<FeedbackOutcome, { kind: "failed" }>["reason"], string> = {
  not_configured:
    "Die Auswertung ist noch nicht eingerichtet. Bitte trage GEMINI_API_KEY und SUPABASE_SERVICE_ROLE_KEY in .env.local ein.",
  unavailable: "Der KI-Dienst ist gerade überlastet. Bitte versuche es in ein paar Minuten erneut.",
  invalid_output: "Die KI hat keine gültige Auswertung geliefert. Bitte versuche es erneut.",
  storage: "Die Auswertung konnte nicht gespeichert werden. Bitte versuche es erneut.",
};

/** (Re)creates feedback for a finished interview that has none yet. */
export async function POST(_request: Request, ctx: RouteContext<"/api/interviews/[id]/feedback">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "Ungültige Anfrage.");

  // RLS: only the user's own interview and feedback are visible.
  const { data: interview } = await supabase
    .from("interviews")
    .select("id, user_id, track, status, transcript, duration_seconds, interview_feedback(id)")
    .eq("id", id.data)
    .maybeSingle();

  if (!interview) return apiError(404, "Interview nicht gefunden.");
  if (interview.status !== "finished") {
    return apiError(409, "Für dieses Interview gibt es keine Auswertung.");
  }
  if (interview.interview_feedback) {
    return apiOk<GenerateFeedbackResponse>({ feedback: "ready" });
  }

  const outcome = await generateAndStoreFeedback(interview);
  if (outcome.kind === "failed") {
    return apiError(outcome.reason === "not_configured" ? 503 : 502, FAILURE_MESSAGES[outcome.reason]);
  }
  return apiOk<GenerateFeedbackResponse>({ feedback: outcome.kind });
}
