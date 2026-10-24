import "server-only";
import { createHash } from "node:crypto";
import { getVoiceId } from "@/lib/elevenlabs";
import { createAdminClient } from "@/lib/supabase/admin";
import { getScript, type SpeechItem } from "./script";
import type { InterviewTrack } from "./tracks";

/**
 * Pre-rendered talking-head clips of the interviewer (D-ID), one per spoken
 * line, created by `npm run videos:generate`. Each clip is stored with the
 * exact MP3 it was lip-synced to, so the app plays that MP3 instead of a new
 * TTS rendition. Private bucket: the browser only gets short-lived signed URLs.
 */
export const INTERVIEWER_VIDEO_BUCKET = "interviewer-videos";

/** Long enough for one interview including breaks. */
const SIGNED_URL_SECONDS = 6 * 60 * 60;

/** Storage path without extension; changes when the text or the voice changes. */
export function clipPath(track: InterviewTrack, text: string) {
  const hash = createHash("sha256").update(`${getVoiceId()}\n${text}`).digest("hex").slice(0, 24);
  return `${track}/${hash}`;
}

/** All spoken lines of a track with their text. */
export function speechLines(track: InterviewTrack): { item: SpeechItem; text: string }[] {
  const script = getScript(track);
  if (!script) return [];
  return [
    { item: "intro", text: script.intro },
    ...script.questions.map((q) => ({ item: `q:${q.id}` as const, text: q.text })),
    { item: "outro", text: script.outro },
  ];
}

/** Signed video URLs for every line that has a clip. Empty if none exist. */
export async function getInterviewerVideoUrls(track: InterviewTrack): Promise<Partial<Record<SpeechItem, string>>> {
  const admin = createAdminClient();
  const lines = speechLines(track);
  if (!admin || lines.length === 0) return {};

  const paths = lines.map((line) => `${clipPath(track, line.text)}.mp4`);
  const { data, error } = await admin.storage.from(INTERVIEWER_VIDEO_BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) return {};

  const urls: Partial<Record<SpeechItem, string>> = {};
  data.forEach((entry, index) => {
    const line = lines[index];
    if (line && entry.signedUrl && !entry.error) urls[line.item] = entry.signedUrl;
  });
  return urls;
}

/** The MP3 a clip was rendered with, or null if there is no clip for this line. */
export async function getClipAudio(track: InterviewTrack, text: string): Promise<Buffer | null> {
  const admin = createAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(INTERVIEWER_VIDEO_BUCKET).download(`${clipPath(track, text)}.mp3`);
  if (error || !data) return null;
  return Buffer.from(await data.arrayBuffer());
}
