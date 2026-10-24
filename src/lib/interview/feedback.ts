import "server-only";
import { awardXp, feedbackScoreXp, INTERVIEW_BONUS_MIN_SCORE, XP_REWARDS } from "@/lib/gamification/xp";
import { generateJson, LlmError, type LlmUsage } from "@/lib/llm";
import { getRubric, type Rubric } from "@/lib/prompts/feedback-rubrics";
import { buildFeedbackPrompt, feedbackSystemPrompt } from "@/lib/prompts/interview-feedback";
import { llmFeedbackSchema, type LlmFeedback, type StoredScores } from "@/lib/schemas/feedback";
import { transcriptSchema, type TranscriptEntry } from "@/lib/schemas/interview";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Json } from "@/lib/supabase/database.types";
import { getTranscriptStats } from "./transcript-stats";
import { TRACKS, type InterviewTrack } from "./tracks";

export type FeedbackOutcome =
  | { kind: "ready" }
  | { kind: "failed"; reason: "not_configured" | "unavailable" | "invalid_output" | "storage" };

type InterviewForFeedback = {
  id: string;
  user_id: string;
  track: InterviewTrack;
  transcript: Json;
  duration_seconds: number | null;
};

/** Lowercase, strip punctuation and collapse whitespace for quote matching. */
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function findInvalidQuote(feedback: LlmFeedback, candidateText: string) {
  const haystack = normalize(candidateText);
  return feedback.criteria.find((c) => c.quote && !haystack.includes(normalize(c.quote)));
}

/** Checks the model output against the rubric and the transcript. */
function checkFeedback(rubric: Rubric, candidateText: string) {
  return (feedback: LlmFeedback): string | null => {
    const expected = rubric.criteria.map((c) => c.id);
    const actual = feedback.criteria.map((c) => c.id);
    if (expected.join(",") !== actual.join(",")) {
      return `criteria must have exactly these ids in this order: ${expected.join(", ")}.`;
    }
    const invalid = findInvalidQuote(feedback, candidateText);
    if (invalid) {
      return `the quote for "${invalid.id}" does not appear verbatim in the candidate's answers. Use an exact quote or null.`;
    }
    return null;
  };
}

/** Weighted mean of scored criteria, rounded to one decimal. */
function overallScore(rubric: Rubric, feedback: LlmFeedback) {
  let total = 0;
  let weights = 0;
  for (const criterion of feedback.criteria) {
    const weight = rubric.criteria.find((c) => c.id === criterion.id)?.weight ?? 1;
    if (criterion.score === null) continue;
    total += criterion.score * weight;
    weights += weight;
  }
  return weights ? Math.round((total / weights) * 10) / 10 : null;
}

/** Evaluates the transcript with Gemma 4 26B, without storing anything. */
export async function evaluateTranscript(input: {
  track: InterviewTrack;
  transcript: TranscriptEntry[];
  durationSeconds: number | null;
}): Promise<{ scores: StoredScores; feedback: LlmFeedback; usage: LlmUsage[] }> {
  const rubric = getRubric(input.track);
  const stats = getTranscriptStats(input.transcript);
  const candidateText = input.transcript
    .filter((e) => e.role === "candidate")
    .map((e) => e.text)
    .join(" ");

  const { data, usage } = await generateJson(llmFeedbackSchema, {
    // 26B: ~20 s instead of 1-2 min with 31B at comparable feedback quality.
    tier: "live",
    system: feedbackSystemPrompt,
    prompt: buildFeedbackPrompt({
      track: TRACKS[input.track],
      rubric,
      transcript: input.transcript,
      stats,
      durationSeconds: input.durationSeconds,
    }),
    check: checkFeedback(rubric, candidateText),
  });

  const scores: StoredScores = {
    rubricVersion: rubric.version,
    model: usage.at(-1)?.model ?? "unknown",
    overall: overallScore(rubric, data),
    criteria: data.criteria.map((c) => ({
      id: c.id,
      title: rubric.criteria.find((r) => r.id === c.id)?.title ?? c.id,
      score: c.score,
      reasoning: c.reasoning,
      quote: c.quote,
    })),
  };
  return { scores, feedback: data, usage };
}

/**
 * Generates feedback for a finished interview, stores it and awards XP.
 * Safe to call again: an existing feedback row is left untouched.
 */
export async function generateAndStoreFeedback(interview: InterviewForFeedback): Promise<FeedbackOutcome> {
  const admin = createAdminClient();
  if (!admin) return { kind: "failed", reason: "not_configured" };

  const transcript = transcriptSchema.safeParse(interview.transcript);
  if (!transcript.success) return { kind: "failed", reason: "invalid_output" };

  let result: Awaited<ReturnType<typeof evaluateTranscript>>;
  try {
    result = await evaluateTranscript({
      track: interview.track,
      transcript: transcript.data,
      durationSeconds: interview.duration_seconds,
    });
  } catch (error) {
    const reason = error instanceof LlmError ? error.code : "unavailable";
    console.error("feedback: generation failed", reason);
    return { kind: "failed", reason };
  }

  const { error } = await admin.from("interview_feedback").insert({
    interview_id: interview.id,
    scores: result.scores,
    strengths: result.feedback.strengths,
    improvements: result.feedback.improvements,
    exercise: result.feedback.exercise,
    summary: result.feedback.summary,
  });
  // 23505: a parallel request stored feedback first, which is fine.
  if (error && error.code !== "23505") {
    console.error("feedback: storing failed", error.code);
    return { kind: "failed", reason: "storage" };
  }

  if (result.scores.overall !== null) {
    await awardXp(interview.user_id, "feedback_score", feedbackScoreXp(result.scores.overall), interview.id);
    if (result.scores.overall > INTERVIEW_BONUS_MIN_SCORE) {
      await awardXp(interview.user_id, "interview_bonus", XP_REWARDS.interviewBonus, interview.id);
    }
  }
  // Token counts only, no content (cost overview follows in step 8).
  console.info(
    "feedback: ready",
    result.usage.map((u) => `${u.model} in=${u.inputTokens} out=${u.outputTokens}`).join(" | "),
  );
  return { kind: "ready" };
}
