import type { TranscriptEntry } from "@/lib/schemas/interview";

// Common German filler words. Speech-to-text often drops "äh"/"ähm",
// so this is a lower bound, which the feedback prompt makes clear.
// Lookarounds instead of \b, because \b does not treat umlauts as letters.
const FILLER_PATTERN =
  /(?<!\p{L})(äh+m*|öh+m*|hm+|also|halt|sozusagen|quasi|irgendwie|eigentlich|genau)(?!\p{L})/giu;

export type TranscriptStats = {
  candidateAnswers: number;
  candidateWords: number;
  averageAnswerWords: number;
  longestAnswerWords: number;
  fillerWords: number;
  fillerPer100Words: number;
};

function countWords(text: string) {
  return text.split(/\s+/).filter(Boolean).length;
}

/** Simple, deterministic numbers that ground the "delivery" criterion. */
export function getTranscriptStats(transcript: TranscriptEntry[]): TranscriptStats {
  const answers = transcript.filter((e) => e.role === "candidate").map((e) => e.text);
  const wordCounts = answers.map(countWords);
  const candidateWords = wordCounts.reduce((sum, n) => sum + n, 0);
  const fillerWords = answers.reduce((sum, text) => sum + (text.match(FILLER_PATTERN)?.length ?? 0), 0);

  return {
    candidateAnswers: answers.length,
    candidateWords,
    averageAnswerWords: answers.length ? Math.round(candidateWords / answers.length) : 0,
    longestAnswerWords: Math.max(0, ...wordCounts),
    fillerWords,
    fillerPer100Words: candidateWords ? Math.round((fillerWords / candidateWords) * 1000) / 10 : 0,
  };
}

/** Below this the interview is too short for a meaningful evaluation. */
export const MIN_CANDIDATE_WORDS_FOR_FEEDBACK = 60;
