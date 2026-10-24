import type { ResumeChange } from "@/lib/resume/diff";
import type { ResumeLanguage, ResumeTrack } from "@/lib/schemas/resume";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : "Etwas ist schiefgelaufen. Bitte versuch es noch einmal.";
    throw new Error(message);
  }
  return body as T;
}

function json(method: string, body: unknown): RequestInit {
  return { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) };
}

/** Creates the resume for a track, or rebuilds the existing one from the current profile. */
export function generateResume(input: { track: ResumeTrack; targetRole: string; language: ResumeLanguage }): Promise<{ id: string }> {
  return request("/api/resume/generate", json("POST", input));
}

export function reviseResume(
  id: string,
  instruction: string,
): Promise<{ version: number | null; note: string; changes: ResumeChange[] }> {
  return request(`/api/resume/${id}/revise`, json("POST", { instruction }));
}

export function decideDraft(id: string, version: number, acceptedChangeIds: string[]): Promise<{ activeVersion: number }> {
  return request(`/api/resume/${id}/draft`, json("POST", { version, acceptedChangeIds }));
}

/** Either takes over a new role or switches to another version. */
export function updateResume(
  id: string,
  patch: { targetRole: string } | { activeVersion: number },
): Promise<{ activeVersion: number }> {
  return request(`/api/resume/${id}`, json("PATCH", patch));
}

export function deleteResume(id: string): Promise<void> {
  return request(`/api/resume/${id}`, { method: "DELETE" });
}

export function exportUrl(id: string, format: "docx" | "pdf", version?: number): string {
  const params = new URLSearchParams({ format });
  if (version !== undefined) params.set("version", String(version));
  return `/api/resume/${id}/export?${params.toString()}`;
}
