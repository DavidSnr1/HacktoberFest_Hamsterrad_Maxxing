import type { NextRequest } from "next/server";
import { apiError } from "@/lib/api";
import { ElevenLabsError } from "@/lib/elevenlabs";
import { getSpeechText } from "@/lib/interview/script";
import { getSpeechAudio } from "@/lib/interview/speech-cache";
import { trackSchema } from "@/lib/schemas/interview";
import { getCurrentUser } from "@/lib/supabase/server";

/**
 * Returns the interviewer's spoken line as MP3. Only fixed script texts can be
 * requested (by id), so this cannot be abused as a general TTS proxy.
 * Signed-in users only, to protect the ElevenLabs credits.
 */
export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich erneut an.");

  const track = trackSchema.safeParse(request.nextUrl.searchParams.get("track"));
  const item = request.nextUrl.searchParams.get("item") ?? "";
  const text = track.success ? getSpeechText(track.data, item) : null;
  if (!text) return apiError(404, "Diese Frage gibt es nicht.");

  try {
    const audio = await getSpeechAudio(text);
    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (error) {
    if (error instanceof ElevenLabsError && error.code === "not_configured") {
      return apiError(503, "Die Sprachausgabe ist noch nicht eingerichtet (ELEVENLABS_API_KEY fehlt).");
    }
    console.error("speech:", error instanceof Error ? error.message : "unknown error");
    return apiError(502, "Die Sprachausgabe ist gerade nicht erreichbar.");
  }
}
