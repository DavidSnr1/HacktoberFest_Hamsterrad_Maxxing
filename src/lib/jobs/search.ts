import "server-only";

import { createHash } from "node:crypto";

import {
  isDemoSource,
  sourceStatusSchema,
  type JobPosting,
  type JobPostingDraft,
  type JobSearchParams,
  type JobSearchResult,
  type SourceStatus,
} from "@/lib/schemas/job-posting";
import { adminClient, userClient } from "./db";
import { SourceError } from "./http";
import { mergeResults } from "./merge";
import { draftToInsert, JOB_POSTING_COLUMNS, rowToPosting, type JobPostingRow } from "./repository";
import { getEnabledSources, getSource } from "./sources";
import type { JobSource } from "./sources/types";

const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const SOURCE_TIMEOUT_MS = 10_000;

function cacheKey(params: JobSearchParams, sources: JobSource[]): string {
  const normalized = {
    q: params.q?.toLowerCase() ?? "",
    location: params.location?.toLowerCase() ?? "",
    track: params.track ?? "",
    type: params.type ?? "",
    sources: sources.map((source) => source.id).sort(),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

function errorMessage(error: unknown): string {
  if (error instanceof SourceError) {
    if (error.reason === "blocked") return "Blockiert automatische Anfragen";
    if (error.reason === "timeout") return "Zeitüberschreitung";
    if (error.reason === "parse") return "Antwort konnte nicht gelesen werden";
  }
  return "Nicht erreichbar";
}

async function runSource(source: JobSource, params: JobSearchParams): Promise<JobPostingDraft[]> {
  return source.search(params, { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) });
}

function orderedPostings(rows: JobPostingRow[], ids: string[]): JobPosting[] {
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const posting = row ? rowToPosting(row) : null;
    return posting ? [posting] : [];
  });
}

export async function searchJobs(params: JobSearchParams): Promise<JobSearchResult> {
  const sources = getEnabledSources();
  const key = cacheKey(params, sources);
  const admin = adminClient();

  const { data: cached } = await admin
    .from("job_search_cache")
    .select("posting_ids, source_status, created_at")
    .eq("query_hash", key)
    .maybeSingle();

  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    const { data: rows } = await admin.from("job_postings").select(JOB_POSTING_COLUMNS).in("id", cached.posting_ids);
    const status = sourceStatusSchema.array().safeParse(cached.source_status);
    return {
      postings: orderedPostings(rows ?? [], cached.posting_ids),
      sources: status.success ? status.data : [],
      cached: true,
    };
  }

  const settled = await Promise.allSettled(sources.map((source) => runSource(source, params)));
  const statuses: SourceStatus[] = sources.map((source, index) => {
    const outcome = settled[index];
    if (outcome?.status !== "fulfilled") {
      return { id: source.id, label: source.label, ok: false, count: 0, error: errorMessage(outcome?.reason) };
    }
    const demo = outcome.value.some((draft) => isDemoSource(draft.source));
    const label = demo ? `${source.label} (Beispieldaten)` : source.label;
    return { id: source.id, label, ok: true, count: outcome.value.length };
  });
  const drafts = mergeResults(
    settled.map((outcome) => (outcome.status === "fulfilled" ? outcome.value : [])),
    params,
  );

  // All drafts write the same columns, so one batch is safe (no column is filled with defaults).
  const rows: JobPostingRow[] = [];
  if (drafts.length > 0) {
    const { data, error } = await admin
      .from("job_postings")
      .upsert(drafts.map(draftToInsert), { onConflict: "source,source_id" })
      .select(JOB_POSTING_COLUMNS);
    if (error) throw new Error("job_postings upsert failed");
    rows.push(...(data ?? []));
  }
  const idByKey = new Map(rows.map((row) => [`${row.source}|${row.source_id}`, row.id]));
  const ids = drafts.flatMap((draft) => idByKey.get(`${draft.source}|${draft.sourceId}`) ?? []);
  const postings = orderedPostings(rows, ids);

  // Only cache when at least one source answered, so a full outage is retried next time.
  if (statuses.some((status) => status.ok)) {
    await admin.from("job_search_cache").upsert({
      query_hash: key,
      posting_ids: postings.map((posting) => posting.id),
      source_status: statuses,
      created_at: new Date().toISOString(),
    });
  }

  return { postings, sources: statuses, cached: false };
}

// Loads one posting as the current user; loads the detail page once if the source supports it.
export async function getJobPosting(id: string): Promise<JobPosting | null> {
  const supabase = await userClient();
  const { data: row } = await supabase.from("job_postings").select(JOB_POSTING_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return null;
  const posting = rowToPosting(row);
  if (!posting || row.details_fetched_at) return posting;

  const source = getSource(row.source);
  if (!source?.fetchDetails || !source.isEnabled()) return posting;
  try {
    const details = await source.fetchDetails(
      { sourceId: row.source_id, sourceUrl: row.source_url },
      { signal: AbortSignal.timeout(SOURCE_TIMEOUT_MS) },
    );
    if (!details) return posting;
    const admin = adminClient();
    const { data: updated } = await admin
      .from("job_postings")
      .update({
        ...(details.description ? { description: details.description } : {}),
        detail_insights: details.insights ?? {},
        details_fetched_at: new Date().toISOString(),
      })
      .eq("id", id)
      .select(JOB_POSTING_COLUMNS)
      .maybeSingle();
    return (updated && rowToPosting(updated)) ?? posting;
  } catch {
    // Blocked or offline: keep the search data and try again next time; the UI links to the original.
    return posting;
  }
}
