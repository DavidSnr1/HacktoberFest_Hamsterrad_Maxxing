import type { JobInsights, JobPostingDraft, JobSearchParams } from "@/lib/schemas/job-posting";

export type SourceContext = {
  signal: AbortSignal;
};

export type JobDetails = {
  description: string | null; // full plain-text description
  insights?: Partial<JobInsights>; // facts only visible on the detail page
};

export type JobSource = {
  id: string;
  label: string;
  // "official" = public API with permission to use; "scraped" = HTML pages, behind a feature flag.
  kind: "official" | "scraped";
  isEnabled(): boolean;
  search(params: JobSearchParams, context: SourceContext): Promise<JobPostingDraft[]>;
  // Optional: load the detail page when the search only returns a snippet or misses facts.
  fetchDetails?(posting: { sourceId: string; sourceUrl: string }, context: SourceContext): Promise<JobDetails | null>;
};
