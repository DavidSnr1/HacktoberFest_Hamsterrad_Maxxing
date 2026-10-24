import "server-only";

import { z } from "zod";

import { emptyInsights, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { fetchJson, SourceError } from "../http";
import { buildKeywords, detectEmploymentType } from "../normalize";
import { cleanLine, htmlToText, toIsoDate } from "../text";
import type { JobSource } from "./types";

// Free public API (https://www.arbeitnow.com/blog/job-board-api). It has no search parameters,
// so we read the newest pages and filter locally.
const API_URL = "https://www.arbeitnow.com/api/job-board-api";
const PAGES = 2;

const jobSchema = z.object({
  slug: z.string(),
  company_name: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().default(""),
  remote: z.boolean().optional(),
  url: z.url(),
  tags: z.array(z.string()).default([]),
  job_types: z.array(z.string()).default([]),
  location: z.string().nullable().optional(),
  created_at: z.number().optional(),
});
type ArbeitnowJob = z.infer<typeof jobSchema>;

const responseSchema = z.object({ data: z.array(z.unknown()) });

function normalizeTerm(value: string): string {
  return value.toLowerCase().normalize("NFC");
}

function matches(job: ArbeitnowJob, params: JobSearchParams): boolean {
  const keywords = buildKeywords(params);
  if (keywords) {
    const haystack = normalizeTerm([job.title, job.company_name, ...job.tags, ...job.job_types].join(" "));
    const terms = normalizeTerm(keywords).split(/\s+/).filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  if (params.location) {
    const location = normalizeTerm(job.location ?? "");
    if (!location.includes(normalizeTerm(params.location)) && !job.remote) return false;
  }
  return true;
}

export function parseResponse(data: unknown, params: JobSearchParams): JobPostingDraft[] {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new SourceError("Unerwartetes Antwortformat", "parse");

  const drafts: JobPostingDraft[] = [];
  for (const raw of parsed.data.data) {
    const item = jobSchema.safeParse(raw);
    if (!item.success || !matches(item.data, params)) continue;
    const job = item.data;
    const location = [cleanLine(job.location), job.remote ? "Remote" : null].filter(Boolean).join(" · ");
    drafts.push({
      source: "arbeitnow",
      sourceId: job.slug,
      sourceUrl: job.url,
      title: cleanLine(job.title) ?? job.title,
      company: cleanLine(job.company_name),
      location: location || null,
      track: null,
      employmentType: detectEmploymentType([job.title, ...job.job_types].join(" ")),
      description: htmlToText(job.description),
      publishedAt: toIsoDate(job.created_at),
      insights: emptyInsights(),
    });
  }
  return drafts;
}

export const arbeitnowSource: JobSource = {
  id: "arbeitnow",
  label: "Arbeitnow",
  kind: "official",
  isEnabled: () => true,
  async search(params, { signal }) {
    const results: JobPostingDraft[] = [];
    for (let page = 1; page <= PAGES; page++) {
      const data = await fetchJson(`${API_URL}?page=${page}`, { signal });
      results.push(...parseResponse(data, params));
    }
    return results;
  },
};
