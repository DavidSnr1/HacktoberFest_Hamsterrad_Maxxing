import type { NextRequest } from "next/server";
import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { ElevenLabsError, getSignedUrl } from "@/lib/elevenlabs";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type SignedUrlResponse = { signedUrl: string };

/**
 * Returns a signed ElevenLabs URL for one of the user's running interviews.
 * The agent is chosen from the interview's track, never from client input.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const interviewId = z.uuid().safeParse(request.nextUrl.searchParams.get("interviewId"));
  if (!interviewId.success) return apiError(400, "Ungültige Anfrage.");

  // RLS limits this to the user's own interviews.
  const { data: interview } = await supabase
    .from("interviews")
    .select("track, status")
    .eq("id", interviewId.data)
    .maybeSingle();

  if (!interview) return apiError(404, "Interview nicht gefunden.");
  if (interview.status !== "running") {
    return apiError(409, "Dieses Interview ist bereits beendet.");
  }

  try {
    const signedUrl = await getSignedUrl(interview.track);
    return apiOk<SignedUrlResponse>({ signedUrl });
  } catch (error) {
    if (error instanceof ElevenLabsError && error.code === "not_configured") {
      return apiError(
        503,
        "Der Interviewer ist noch nicht eingerichtet. Bitte trage den ElevenLabs-Key und die Agent-ID in .env.local ein (siehe README).",
      );
    }
    // Log only the error type and status, never user data.
    console.error("signed-url:", error instanceof Error ? error.message : "unknown error");
    return apiError(502, "Der Sprachdienst ist gerade nicht erreichbar. Bitte versuche es gleich noch einmal.");
  }
}
