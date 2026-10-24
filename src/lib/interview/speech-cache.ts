import "server-only";
import { cacheLife } from "next/cache";
import { getVoiceId, synthesizeSpeech } from "@/lib/elevenlabs";

/**
 * Interviewer lines are fixed texts, so each one is synthesized once and then
 * served from the cache, which saves ElevenLabs credits. The voice id is part
 * of the cache key, so changing ELEVENLABS_VOICE_ID produces new audio.
 * Only static script texts go through here, never user data.
 */
async function cachedSpeech(text: string, voiceKey: string): Promise<string> {
  "use cache";
  cacheLife("max");
  void voiceKey;
  const audio = await synthesizeSpeech(text);
  return Buffer.from(audio).toString("base64");
}

export async function getSpeechAudio(text: string): Promise<Buffer> {
  return Buffer.from(await cachedSpeech(text, getVoiceId()), "base64");
}
