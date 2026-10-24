import { consultingScript } from "@/lib/prompts/interviewer-consulting";
import type { InterviewTrack } from "./tracks";

export type InterviewQuestion = {
  /** Stable id, stored with the answer in the transcript. Do not rename. */
  id: string;
  /** Read aloud and shown on screen. */
  text: string;
  /** Thinking time before recording starts (can be skipped). */
  prepSeconds: number;
  /** Maximum answer length; recording stops automatically. */
  answerSeconds: number;
};

export type InterviewScript = {
  intro: string;
  questions: InterviewQuestion[];
  outro: string;
};

/** Question scripts per track; tracks without one are not startable. */
const SCRIPTS: Partial<Record<InterviewTrack, InterviewScript>> = {
  consulting: consultingScript,
};

export function getScript(track: InterviewTrack): InterviewScript | null {
  return SCRIPTS[track] ?? null;
}

/** Ids of everything the interviewer says: "intro", "outro" or a question id. */
export type SpeechItem = "intro" | "outro" | `q:${string}`;

/** Resolves a speech item to its text, or null if it does not exist. */
export function getSpeechText(track: InterviewTrack, item: string): string | null {
  const script = getScript(track);
  if (!script) return null;
  if (item === "intro") return script.intro;
  if (item === "outro") return script.outro;
  if (item.startsWith("q:")) return script.questions.find((q) => q.id === item.slice(2))?.text ?? null;
  return null;
}
