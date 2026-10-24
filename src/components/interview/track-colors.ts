import type { InterviewTrack } from "@/lib/interview/tracks";

/** Sector colour per track, exposed to children as the --track CSS variable. */
export const TRACK_COLORS: Record<InterviewTrack, string> = {
  consulting: "[--track:var(--consulting)]",
  finance: "[--track:var(--finance)]",
  startup: "[--track:var(--startup)]",
};
