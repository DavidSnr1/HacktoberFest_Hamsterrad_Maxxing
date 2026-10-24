import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

export const trackSchema = z.enum(Constants.public.Enums.interview_track);

export const createInterviewSchema = z.object({ track: trackSchema });

export const transcriptEntrySchema = z.object({
  role: z.enum(["interviewer", "candidate"]),
  text: z.string().trim().min(1).max(5000),
  /** Seconds since the conversation started. */
  at: z.number().int().min(0).max(7200),
});

export const transcriptSchema = z.array(transcriptEntrySchema).max(600);

export const finishInterviewSchema = z.object({
  status: z.enum(["finished", "aborted"]),
  transcript: transcriptSchema,
  durationSeconds: z.number().int().min(0).max(7200),
});

export type TranscriptEntry = z.infer<typeof transcriptEntrySchema>;
export type FinishInterviewInput = z.infer<typeof finishInterviewSchema>;
