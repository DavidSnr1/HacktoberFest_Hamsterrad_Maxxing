import "server-only";
import type { InterviewTrack } from "@/lib/interview/tracks";

const API_BASE = "https://api.elevenlabs.io";

export class ElevenLabsError extends Error {
  constructor(
    readonly code: "not_configured" | "upstream",
    message: string,
  ) {
    super(message);
    this.name = "ElevenLabsError";
  }
}

// Literal env access per track, so nothing is read dynamically from user input.
function getAgentId(track: InterviewTrack): string | undefined {
  switch (track) {
    case "consulting":
      return process.env.ELEVENLABS_AGENT_ID_CONSULTING;
    case "finance":
      return process.env.ELEVENLABS_AGENT_ID_FINANCE;
    case "startup":
      return process.env.ELEVENLABS_AGENT_ID_STARTUP;
  }
}

/**
 * Returns a short-lived signed WebSocket URL for the track's agent.
 * The browser connects with it and never sees the API key.
 */
export async function getSignedUrl(track: InterviewTrack): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = getAgentId(track);
  if (!apiKey || !agentId) {
    throw new ElevenLabsError("not_configured", `ElevenLabs is not configured for track ${track}`);
  }

  const url = new URL("/v1/convai/conversation/get-signed-url", API_BASE);
  url.searchParams.set("agent_id", agentId);

  const response = await fetch(url, {
    headers: { "xi-api-key": apiKey },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new ElevenLabsError("upstream", `get-signed-url failed with status ${response.status}`);
  }

  const body: unknown = await response.json();
  if (
    typeof body !== "object" ||
    body === null ||
    !("signed_url" in body) ||
    typeof body.signed_url !== "string"
  ) {
    throw new ElevenLabsError("upstream", "get-signed-url returned an unexpected body");
  }
  return body.signed_url;
}
