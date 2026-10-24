import "server-only";

import { z } from "zod";

import { emptyInsights, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { fetchJson, SourceError } from "../http";
import { buildKeywords } from "../normalize";
import { cleanLine, htmlToText, toIsoDate } from "../text";
import type { JobSource } from "./types";

// Official Adzuna API (https://developer.adzuna.com), free key required. Only active when configured.
const API_URL = "https://api.adzuna.com/v1/api/jobs/de/search/1";

const jobSchema = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  title: z.string(),
  description: z.string().default(""),
  redirect_url: z.url(),
  created: z.string().optional(),
  company: z.object({ display_name: z.string().optional() }).optional(),
  location: z.object({ display_name: z.string().optional() }).optional(),
  salary_min: z.number().optional(),
  salary_max: z.number().optional(),
});

const responseSchema = z.object({ results: z.array(z.unknown()) });

export function buildSearchUrl(params: JobSearchParams, appId: string, appKey: string): string {
  const url = new URL(API_URL);
  url.searchParams.set("app_id", appId);
  url.searchParams.set("app_key", appKey);
  url.searchParams.set("results_per_page", "25");
  url.searchParams.set("max_days_old", "60");
  const keywords = buildKeywords(params);
  if (keywords) url.searchParams.set("what", keywords);
  if (params.location) url.searchParams.set("where", params.location);
  return url.toString();
}

export function parseResponse(data: unknown): JobPostingDraft[] {
  const parsed = responseSchema.safeParse(data);
  if (!parsed.success) throw new SourceError("Unerwartetes Antwortformat", "parse");

  const drafts: JobPostingDraft[] = [];
  for (const raw of parsed.data.results) {
    const item = jobSchema.safeParse(raw);
    if (!item.success) continue;
    const job = item.data;
    drafts.push({
      source: "adzuna",
      sourceId: job.id,
      sourceUrl: job.redirect_url,
      title: htmlToText(job.title),
      company: cleanLine(job.company?.display_name),
      location: cleanLine(job.location?.display_name),
      track: null,
      employmentType: null,
      // Adzuna only returns a snippet of the description.
      description: htmlToText(job.description),
      publishedAt: toIsoDate(job.created),
      insights: {
        ...emptyInsights(),
        salary:
          job.salary_min || job.salary_max
            ? { min: job.salary_min ?? null, max: job.salary_max ?? null, currency: "EUR", period: "year" }
            : null,
      },
    });
  }
  return drafts;
}

export const adzunaSource: JobSource = {
  id: "adzuna",
  label: "Adzuna",
  kind: "official",
  isEnabled: () => Boolean(process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY),
  async search(params, { signal }) {
    const appId = process.env.ADZUNA_APP_ID ?? "";
    const appKey = process.env.ADZUNA_APP_KEY ?? "";
    return parseResponse(await fetchJson(buildSearchUrl(params, appId, appKey), { signal }));
  },
};
