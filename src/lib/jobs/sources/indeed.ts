import "server-only";

import { load } from "cheerio";
import { z } from "zod";

import { emptyInsights, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { extractJsonAfter, extractJsonLd, isRecord, looksLikeBotChallenge } from "../embedded-json";
import { fetchHtml, SourceError } from "../http";
import { buildKeywords } from "../normalize";
import { cleanLine, htmlToText, toIsoDate } from "../text";
import { indeedMockEnabled, scrapedSourcesEnabled } from "./flags";
import { buildMockResults, DEMO_ID_PREFIX } from "./indeed-mock";
import type { JobDetails, JobSource } from "./types";

// HTML scraping of public result pages. On unless JOBS_ENABLE_SCRAPED_SOURCES=false.
// Indeed usually shows a "Security Check" to non-browser clients. The search then returns example
// postings (indeed-mock.ts) unless JOBS_INDEED_MOCK=false, which reports the source as "blocked".
const BASE_URL = "https://de.indeed.com";
// Few enough that real postings from other sources stay the majority.
const MOCK_FALLBACK_COUNT = 5;
const STATE_MARKER = 'window.mosaic.providerData["mosaic-provider-jobcards"]=';

const resultSchema = z.object({
  jobkey: z.string(),
  title: z.string().optional(),
  displayTitle: z.string().optional(),
  company: z.string().nullable().optional(),
  formattedLocation: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
  pubDate: z.number().nullable().optional(),
});

export function buildSearchUrl(params: JobSearchParams): string {
  const url = new URL(`${BASE_URL}/jobs`);
  url.searchParams.set("q", buildKeywords(params) || "Praktikum");
  if (params.location) url.searchParams.set("l", params.location);
  url.searchParams.set("fromage", "30");
  return url.toString();
}

function resultsFrom(state: unknown): unknown[] | null {
  if (!isRecord(state) || !isRecord(state.metaData)) return null;
  const model = state.metaData.mosaicProviderJobCardsModel;
  return isRecord(model) && Array.isArray(model.results) ? model.results : null;
}

export function parseSearchPage(html: string): JobPostingDraft[] {
  const results = resultsFrom(extractJsonAfter(html, STATE_MARKER));
  if (!results) {
    if (looksLikeBotChallenge(html)) throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
    throw new SourceError("Suchergebnisse nicht gefunden", "parse");
  }

  const drafts: JobPostingDraft[] = [];
  for (const raw of results) {
    const item = resultSchema.safeParse(raw);
    if (!item.success) continue;
    const job = item.data;
    const title = cleanLine(job.displayTitle ?? job.title);
    if (!title) continue;
    drafts.push({
      source: "indeed",
      sourceId: job.jobkey,
      sourceUrl: `${BASE_URL}/viewjob?jk=${encodeURIComponent(job.jobkey)}`,
      title,
      company: cleanLine(job.company),
      location: cleanLine(job.formattedLocation),
      track: null,
      employmentType: null,
      description: job.snippet ? htmlToText(job.snippet) : "",
      publishedAt: toIsoDate(job.pubDate),
      insights: emptyInsights(),
    });
  }
  return drafts;
}

export function parseDetailPage(html: string): JobDetails | null {
  const markup = load(html)("#jobDescriptionText").first().html();
  const posting = extractJsonLd(html).find((block) => block["@type"] === "JobPosting");
  const description = markup
    ? htmlToText(markup)
    : typeof posting?.description === "string"
      ? htmlToText(posting.description)
      : "";
  return description ? { description } : null;
}

export const indeedSource: JobSource = {
  id: "indeed",
  label: "Indeed",
  kind: "scraped",
  isEnabled: scrapedSourcesEnabled,
  async search(params, { signal }) {
    const url = buildSearchUrl(params);
    try {
      return parseSearchPage(await fetchHtml(url, { signal }));
    } catch (error) {
      // No bypass of the security check: fall back to labelled example postings instead.
      if (!indeedMockEnabled()) throw error;
      return buildMockResults(params, url, MOCK_FALLBACK_COUNT);
    }
  },
  async fetchDetails({ sourceId }, { signal }) {
    if (sourceId.startsWith(DEMO_ID_PREFIX)) return null; // example posting, nothing to load
    const html = await fetchHtml(`${BASE_URL}/viewjob?jk=${encodeURIComponent(sourceId)}`, { signal });
    const details = parseDetailPage(html);
    if (!details && looksLikeBotChallenge(html)) throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
    return details;
  },
};
