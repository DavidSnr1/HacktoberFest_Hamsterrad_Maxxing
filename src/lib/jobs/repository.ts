import "server-only";

import {
  emptyInsights,
  jobInsightsSchema,
  jobPostingSchema,
  type JobInsights,
  type JobPosting,
  type JobPostingDraft,
} from "@/lib/schemas/job-posting";
import type { Database } from "@/lib/supabase/database.types";

export type JobPostingRow = Database["public"]["Tables"]["job_postings"]["Row"];
type JobPostingInsert = Database["public"]["Tables"]["job_postings"]["Insert"];

export const JOB_POSTING_COLUMNS =
  "id, source, source_id, source_url, title, company, location, track, employment_type, description, snippet, insights, detail_insights, details_fetched_at, published_at, fetched_at";

function parseInsights(value: unknown): JobInsights {
  const parsed = jobInsightsSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : emptyInsights();
}

// Detail-page facts win over search facts, but only where they actually carry a value.
export function mergeInsights(base: JobInsights, detail: Partial<JobInsights>): JobInsights {
  const merged = { ...base };
  for (const [key, value] of Object.entries(detail) as [keyof JobInsights, JobInsights[keyof JobInsights]][]) {
    if (value !== null && value !== undefined && value !== false) Object.assign(merged, { [key]: value });
  }
  return merged;
}

export function rowToPosting(row: JobPostingRow): JobPosting | null {
  const detail = jobInsightsSchema.partial().safeParse(row.detail_insights ?? {});
  const parsed = jobPostingSchema.safeParse({
    id: row.id,
    source: row.source,
    sourceUrl: row.source_url,
    title: row.title,
    company: row.company,
    location: row.location,
    track: row.track,
    employmentType: row.employment_type,
    // Full text from the detail page if loaded, otherwise the search snippet.
    description: row.description || row.snippet,
    publishedAt: row.published_at,
    insights: mergeInsights(parseInsights(row.insights), detail.success ? detail.data : {}),
  });
  return parsed.success ? parsed.data : null;
}

// Search results only write search columns; description/detail_insights belong to the detail fetch.
export function draftToInsert(draft: JobPostingDraft): JobPostingInsert {
  return {
    source: draft.source,
    source_id: draft.sourceId,
    source_url: draft.sourceUrl,
    title: draft.title,
    company: draft.company,
    location: draft.location,
    track: draft.track,
    employment_type: draft.employmentType,
    snippet: draft.description,
    insights: draft.insights,
    published_at: draft.publishedAt,
    fetched_at: new Date().toISOString(),
  };
}
