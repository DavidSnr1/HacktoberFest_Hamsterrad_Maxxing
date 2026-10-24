import "server-only";

import { z } from "zod";

import { emptyInsights, type JobInsights, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { extractJsonAfter, extractJsonLd, isRecord, looksLikeBotChallenge } from "../embedded-json";
import { fetchHtml, SourceError } from "../http";
import { buildKeywords, matchesQuery } from "../normalize";
import { cleanLine, htmlToText, normalizeWhitespace, toIsoDate } from "../text";
import { scrapedSourcesEnabled } from "./flags";
import type { JobDetails, JobSource } from "./types";

// HTML scraping of public result pages. Disabled unless JOBS_ENABLE_SCRAPED_SOURCES=true.
const BASE_URL = "https://www.stepstone.de";
const STATE_MARKER = /window\.__PRELOADED_STATE__\["app-unifiedResultlist"\]\s*=\s*/;

const itemSchema = z.object({
  id: z.union([z.number(), z.string()]).transform(String),
  title: z.string(),
  url: z.string(),
  companyName: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  textSnippet: z.string().nullable().optional(),
  datePosted: z.string().nullable().optional(),
  workFromHome: z.string().nullable().optional(),
  publishToDate: z.string().nullable().optional(),
  salary: z.unknown().optional(),
  unifiedSalary: z.unknown().optional(),
  labels: z.array(z.object({ type: z.string().optional() }).passthrough()).nullable().optional(),
});

const salarySchema = z.object({
  salaryAvailable: z.boolean().optional(),
  min: z.number().nullable().optional(),
  max: z.number().nullable().optional(),
  period: z.string().nullable().optional(),
  currencyIso: z.string().nullable().optional(),
});

const SALARY_PERIODS: Record<string, "year" | "month" | "hour"> = { Annually: "year", Monthly: "month", Hourly: "hour" };

function parseSalary(...candidates: unknown[]): JobInsights["salary"] {
  for (const candidate of candidates) {
    const parsed = salarySchema.safeParse(candidate);
    if (!parsed.success || parsed.data.salaryAvailable === false) continue;
    const { min, max, period, currencyIso } = parsed.data;
    const mapped = period ? SALARY_PERIODS[period] : undefined;
    if ((min || max) && mapped) return { min: min ?? null, max: max ?? null, currency: currencyIso ?? "EUR", period: mapped };
  }
  return null;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function buildSearchUrl(params: JobSearchParams): string {
  const keywords = slugify(buildKeywords(params));
  const location = params.location ? slugify(params.location) : "";
  const path = [keywords, location && `in-${location}`].filter(Boolean).join("/");
  return `${BASE_URL}/jobs/${path || "praktikum"}`;
}

function stripTracking(url: string): string {
  const absolute = new URL(url, BASE_URL);
  absolute.search = "";
  return absolute.toString();
}

// StepStone falls back to generic listings when it does not know a term (e.g. company names),
// so results are only kept if every query term appears in title, company or snippet.
export function parseSearchPage(html: string, params: JobSearchParams = {}): JobPostingDraft[] {
  const state = extractJsonAfter(html, STATE_MARKER);
  const items = isRecord(state) && isRecord(state.searchResults) ? state.searchResults.items : undefined;
  if (!Array.isArray(items)) {
    if (looksLikeBotChallenge(html)) throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
    throw new SourceError("Suchergebnisse nicht gefunden", "parse");
  }

  const drafts: JobPostingDraft[] = [];
  for (const raw of items) {
    const item = itemSchema.safeParse(raw);
    if (!item.success) continue;
    const job = item.data;
    if (params.q && !matchesQuery([job.title, job.companyName, job.textSnippet].join(" "), params.q)) continue;
    const labels = new Set((job.labels ?? []).map((label) => label.type));
    const remote = job.workFromHome === "2" ? "Remote möglich" : null;
    drafts.push({
      source: "stepstone",
      sourceId: job.id,
      sourceUrl: stripTracking(job.url),
      title: cleanLine(job.title) ?? job.title,
      company: cleanLine(job.companyName),
      location: [cleanLine(job.location), remote].filter(Boolean).join(" · ") || null,
      track: null,
      employmentType: null,
      // Snippet only; the full text is loaded on demand from the detail page.
      description: job.textSnippet ? normalizeWhitespace(job.textSnippet) : "",
      publishedAt: toIsoDate(job.datePosted),
      insights: {
        ...emptyInsights(),
        validThrough: toIsoDate(job.publishToDate),
        salary: parseSalary(job.unifiedSalary, job.salary),
        noCoverLetter: labels.has("NO_COVER_LETTER"),
        quickApply: labels.has("QUICK_APPLY"),
      },
    });
  }
  return drafts;
}

export function parseDetailPage(html: string): JobDetails | null {
  const posting = extractJsonLd(html).find((block) => block["@type"] === "JobPosting");
  if (!posting) return null;
  const description = posting.description;
  return {
    description: typeof description === "string" && description.trim() ? htmlToText(description) : null,
    insights: { validThrough: toIsoDate(typeof posting.validThrough === "string" ? posting.validThrough : null) },
  };
}

export const stepstoneSource: JobSource = {
  id: "stepstone",
  label: "StepStone",
  kind: "scraped",
  isEnabled: scrapedSourcesEnabled,
  async search(params, { signal }) {
    return parseSearchPage(await fetchHtml(buildSearchUrl(params), { signal }), params);
  },
  async fetchDetails({ sourceUrl }, { signal }) {
    if (new URL(sourceUrl).host !== new URL(BASE_URL).host) return null;
    return parseDetailPage(await fetchHtml(sourceUrl, { signal }));
  },
};
