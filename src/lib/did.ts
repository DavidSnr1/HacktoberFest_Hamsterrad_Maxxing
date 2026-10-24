import "server-only";

const API_BASE = "https://api.d-id.com";
const POLL_INTERVAL_MS = 3_000;
const TALK_TIMEOUT_MS = 5 * 60_000;

export class DidError extends Error {
  constructor(
    readonly code: "not_configured" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "DidError";
  }
}

function authHeader() {
  // The key from the D-ID Studio already has the "user:password" form Basic auth expects.
  const apiKey = process.env.DID_API_KEY?.trim();
  if (!apiKey) throw new DidError("not_configured", "DID_API_KEY is not set");
  return `Basic ${apiKey}`;
}

async function request(path: string, init: RequestInit): Promise<Record<string, unknown>> {
  const response = await fetch(new URL(path, API_BASE), {
    ...init,
    headers: { Authorization: authHeader(), Accept: "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new DidError("upstream", `D-ID ${init.method ?? "GET"} ${path} failed with status ${response.status}`);
  }
  const body: unknown = await response.json();
  if (typeof body !== "object" || body === null) throw new DidError("upstream", `D-ID ${path} returned no object`);
  return body as Record<string, unknown>;
}

function stringField(body: Record<string, unknown>, field: string) {
  const value = body[field];
  if (typeof value !== "string" || !value) throw new DidError("upstream", `D-ID response has no ${field}`);
  return value;
}

async function upload(path: string, field: string, data: Blob, filename: string) {
  const form = new FormData();
  form.append(field, data, filename);
  return stringField(await request(path, { method: "POST", body: form }), "url");
}

/** Uploads the interviewer photo (JPG/PNG); returns a temporary D-ID URL. */
export function uploadImage(data: Blob, filename: string) {
  return upload("/images", "image", data, filename);
}

/** Uploads a spoken line; returns a temporary D-ID URL. */
export function uploadAudio(data: Blob, filename: string) {
  return upload("/audios", "audio", data, filename);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Animates the photo so it speaks the audio, waits until D-ID has rendered
 * the clip and returns the MP4 bytes.
 */
export async function renderTalk(imageUrl: string, audioUrl: string): Promise<ArrayBuffer> {
  const created = await request("/talks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_url: imageUrl,
      script: { type: "audio", audio_url: audioUrl },
      // stitch keeps the full photo instead of a cropped face.
      config: { stitch: true, result_format: "mp4" },
    }),
  });
  const id = stringField(created, "id");

  const deadline = Date.now() + TALK_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    const talk = await request(`/talks/${encodeURIComponent(id)}`, { method: "GET" });
    if (talk.status === "done") {
      const video = await fetch(stringField(talk, "result_url"), { cache: "no-store" });
      if (!video.ok) throw new DidError("upstream", `D-ID video download failed with status ${video.status}`);
      return video.arrayBuffer();
    }
    if (talk.status === "error" || talk.status === "rejected") {
      throw new DidError("upstream", `D-ID talk ${id} ended with status ${talk.status}`);
    }
  }
  throw new DidError("upstream", `D-ID talk ${id} timed out`);
}
