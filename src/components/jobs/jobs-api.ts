import type { JobOutlook, JobPosting, JobSearchResult } from "@/lib/schemas/job-posting";

export type SearchForm = {
  q: string;
  location: string;
  track: string;
  type: string;
};

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

export function searchJobs(form: SearchForm): Promise<JobSearchResult> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(form)) {
    if (value.trim()) params.set(key, value.trim());
  }
  return request<JobSearchResult>(`/api/jobs/search?${params.toString()}`);
}

export async function fetchJob(id: string): Promise<JobPosting> {
  const { posting } = await request<{ posting: JobPosting }>(`/api/jobs/${id}`);
  return posting;
}

export async function fetchOutlook(id: string): Promise<JobOutlook> {
  const { outlook } = await request<{ outlook: JobOutlook }>(`/api/jobs/${id}/outlook`);
  return outlook;
}

export async function fetchSavedJobs(): Promise<JobPosting[]> {
  const { postings } = await request<{ postings: JobPosting[] }>("/api/jobs/saved");
  return postings;
}

export async function setJobSaved(id: string, saved: boolean): Promise<void> {
  if (saved) {
    await request("/api/jobs/saved", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId: id }),
    });
  } else {
    await request(`/api/jobs/saved/${id}`, { method: "DELETE" });
  }
}
