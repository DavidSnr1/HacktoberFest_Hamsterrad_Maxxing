import "server-only";

const API_BASE = "https://api.elevenlabs.io";
/** Multilingual model: natural German pronunciation. */
const TTS_MODEL = "eleven_multilingual_v2";
const STT_MODEL = "scribe_v2";
/** Premade voice used if ELEVENLABS_VOICE_ID is not set. */
const DEFAULT_VOICE_ID = "EXAVITQu4vr4xnSDxMaL";

export class ElevenLabsError extends Error {
  constructor(
    readonly code: "not_configured" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

function getApiKey() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new ElevenLabsError("not_configured", "ELEVENLABS_API_KEY is not set");
  return apiKey;
}

/** Text-to-speech for the interviewer's voice. Returns MP3 bytes. */
export async function synthesizeSpeech(text: string): Promise<ArrayBuffer> {
  const voiceId = process.env.ELEVENLABS_VOICE_ID?.trim() || DEFAULT_VOICE_ID;
  const url = new URL(`/v1/text-to-speech/${encodeURIComponent(voiceId)}`, API_BASE);
  url.searchParams.set("output_format", "mp3_44100_128");

  const response = await fetch(url, {
    method: "POST",
    headers: { "xi-api-key": getApiKey(), "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: TTS_MODEL }),
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ElevenLabsError("upstream", `text-to-speech failed with status ${response.status}`);
  }
  return response.arrayBuffer();
}

/**
 * Speech-to-text for one recorded answer. The audio is only forwarded,
 * never stored by the app.
 */
export async function transcribeAudio(audio: Blob, filename: string): Promise<string> {
  const form = new FormData();
  form.append("model_id", STT_MODEL);
  form.append("language_code", "de");
  // No "(Lachen)"-style tags in the transcript.
  form.append("tag_audio_events", "false");
  form.append("file", audio, filename);

  const response = await fetch(new URL("/v1/speech-to-text", API_BASE), {
    method: "POST",
    headers: { "xi-api-key": getApiKey() },
    body: form,
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ElevenLabsError("upstream", `speech-to-text failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null || !("text" in body) || typeof body.text !== "string") {
    throw new ElevenLabsError("upstream", "speech-to-text returned an unexpected body");
  }
  return body.text.trim();
}
