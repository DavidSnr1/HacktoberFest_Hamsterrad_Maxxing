import { z } from "zod";
import { apiError, apiOk } from "@/lib/api";
import { ElevenLabsError, transcribeAudio } from "@/lib/elevenlabs";
import { getScript } from "@/lib/interview/script";
import { answerFieldsSchema, MAX_ANSWER_BYTES, transcriptSchema, type TranscriptEntry } from "@/lib/schemas/interview";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

export type SubmitAnswerResponse = { text: string };

const ACCEPTED_TYPES = /^(audio\/(webm|ogg|mp4|mpeg|wav|x-m4a|aac)|video\/(webm|mp4))(;.*)?$/;

/**
 * Receives one recorded answer, transcribes it with ElevenLabs and stores the
 * question and answer in the interview transcript. The audio itself is not
 * stored. Submitting the same question again replaces the earlier answer.
 */
export async function POST(request: Request, ctx: RouteContext<"/api/interviews/[id]/answers">) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const id = z.uuid().safeParse((await ctx.params).id);
  if (!id.success) return apiError(400, "Ungültige Anfrage.");

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return apiError(400, "Die Aufnahme konnte nicht gelesen werden.");
  }
  const fields = answerFieldsSchema.safeParse({ questionId: form.get("questionId") });
  const audio = form.get("audio");
  if (!fields.success || !(audio instanceof Blob)) return apiError(400, "Ungültige Anfrage.");
  if (audio.size === 0) return apiError(400, "Die Aufnahme ist leer.");
  if (audio.size > MAX_ANSWER_BYTES) return apiError(413, "Die Aufnahme ist zu groß.");
  if (!ACCEPTED_TYPES.test(audio.type)) return apiError(415, "Dieses Audioformat wird nicht unterstützt.");

  // RLS limits this to the user's own interviews.
  const { data: interview } = await supabase
    .from("interviews")
    .select("track, status, started_at, transcript")
    .eq("id", id.data)
    .maybeSingle();
  if (!interview) return apiError(404, "Interview nicht gefunden.");
  if (interview.status !== "running") return apiError(409, "Dieses Interview ist bereits beendet.");

  const script = getScript(interview.track);
  const questionIndex = script?.questions.findIndex((q) => q.id === fields.data.questionId) ?? -1;
  const question = script?.questions[questionIndex];
  if (!script || !question) return apiError(400, "Diese Frage gehört nicht zum Interview.");

  let text: string;
  try {
    const extension = audio.type.includes("mp4") || audio.type.includes("m4a") ? "m4a" : "webm";
    text = await transcribeAudio(audio, `answer.${extension}`);
  } catch (error) {
    if (error instanceof ElevenLabsError && error.code === "not_configured") {
      return apiError(503, "Die Spracherkennung ist noch nicht eingerichtet (ELEVENLABS_API_KEY fehlt).");
    }
    console.error("answers: transcription failed", error instanceof Error ? error.message : "unknown error");
    return apiError(502, "Deine Antwort konnte nicht transkribiert werden. Bitte versuche es erneut.");
  }
  if (!text) return apiOk<SubmitAnswerResponse>({ text: "" });

  const at = Math.max(0, Math.round((Date.now() - new Date(interview.started_at).getTime()) / 1000));
  const existing = transcriptSchema.safeParse(interview.transcript);
  const others = (existing.success ? existing.data : []).filter((e) => e.questionId !== question.id);
  const order = (e: TranscriptEntry) => script.questions.findIndex((q) => q.id === e.questionId);
  const added: TranscriptEntry[] = [
    { role: "interviewer", text: question.text, at, questionId: question.id },
    { role: "candidate", text: text.slice(0, 5000), at, questionId: question.id },
  ];
  const transcript = [...others, ...added].sort((a, b) => order(a) - order(b));

  const { error } = await supabase
    .from("interviews")
    .update({ transcript })
    .eq("id", id.data)
    .eq("status", "running");
  if (error) return apiError(500, "Deine Antwort konnte nicht gespeichert werden. Bitte versuche es erneut.");

  return apiOk<SubmitAnswerResponse>({ text });
}
