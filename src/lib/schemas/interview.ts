import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

export const trackSchema = z.enum(Constants.public.Enums.interview_track);

export const createInterviewSchema = z.object({ track: trackSchema });

export const transcriptEntrySchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string().trim().min(1).max(5000),
  /** Seconds since the interview started. */
  at: z.number().int().min(0).max(86_400),
  /** Script question this entry belongs to (one-way format). */
  questionId: z.string().max(50).optional(),
});

export const transcriptSchema = z.array(transcriptEntrySchema).max(600);

export const finishInterviewSchema = z.object({
  status: z.enum(["finished", "aborted"]),
});

/** Recorded answers above this size are rejected (Vercel's body limit is 4.5 MB). */
export const MAX_ANSWER_BYTES = 4 * 1024 * 1024;

export const answerFieldsSchema = z.object({
  questionId: z.string().min(1).max(50),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
export type FinishInterviewInput = z.infer<typeof finishInterviewSchema>;
