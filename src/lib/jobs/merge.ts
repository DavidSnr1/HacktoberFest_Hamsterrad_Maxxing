import type { JobPostingDraft, JobSearchParams } from "@/lib/schemas/job-posting";
import { dedupeKey, finalizeDraft, matchesFilters } from "./normalize";

const MAX_RESULTS = 100;

// Merges adapter results: validate, filter, drop duplicates (earlier sources win), newest first.
export function mergeResults(resultsPerSource: JobPostingDraft[][], params: JobSearchParams): JobPostingDraft[] {
  const seen = new Set<string>();
  const merged: JobPostingDraft[] = [];
  for (const results of resultsPerSource) {
    for (const raw of results) {
      const draft = finalizeDraft(raw);
      if (!draft || !matchesFilters(draft, params)) continue;
      const key = dedupeKey(draft);
      const sourceKey = `${draft.source}|${draft.sourceId}`;
      if (seen.has(key) || seen.has(sourceKey)) continue;
      seen.add(key).add(sourceKey);
      merged.push(draft);
    }
  }
  return merged
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
    .slice(0, MAX_RESULTS);
}
