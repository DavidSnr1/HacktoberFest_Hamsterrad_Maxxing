import { z } from "zod";

/** What the LLM must return for an interview evaluation. */
export const llmFeedbackSchema = z.object({
  criteria: z
    .array(
      z.object({
        id: z.string(),
        /** null if the transcript gives no evidence for this criterion. */
        score: z.number().int().min(1).max(5).nullable(),
        reasoning: z.string().min(10).max(800),
        /** Verbatim quote from the candidate, or null if none fits. */
        quote: z.string().max(400).nullable(),
      }),
    )
    .min(1)
    .max(10),
  strengths: z.array(z.string().min(5).max(400)).length(3),
  improvements: z.array(z.string().min(5).max(400)).length(3),
  exercise: z.string().min(10).max(800),
  summary: z.string().min(10).max(1200),
});

export type LlmFeedback = z.infer<typeof llmFeedbackSchema>;

/** Shape of interview_feedback.scores (jsonb). */
export const storedScoresSchema = z.object({
  rubricVersion: z.string(),
  model: z.string(),
  /** Weighted mean of all scored criteria, one decimal; null if nothing was scorable. */
  overall: z.number().min(1).max(5).nullable(),
  criteria: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      score: z.number().int().min(1).max(5).nullable(),
      reasoning: z.string(),
      quote: z.string().nullable(),
    }),
  ),
});

export type StoredScores = z.infer<typeof storedScoresSchema>;
