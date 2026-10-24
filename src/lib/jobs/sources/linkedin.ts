import "server-only";

import { load } from "cheerio";

import { emptyInsights, type JobInsights, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { looksLikeBotChallenge } from "../embedded-json";
import { fetchHtml, SourceError } from "../http";
import { buildKeywords } from "../normalize";
import { cleanLine, htmlToText, toIsoDate } from "../text";
import { scrapedSourcesEnabled } from "./flags";
import type { JobDetails, JobSource } from "./types";

// Public guest job search (no login). On unless JOBS_ENABLE_SCRAPED_SOURCES=false.
// LinkedIn often answers with a JS challenge or 429; we report that as "blocked" and do not work around it.
const BASE_URL = "https://www.linkedin.com";
// Free-text "Deutschland" is not reliable (returned US jobs); the geo id restricts results to Germany.
const GERMANY_GEO_ID = "101282230";

export function buildSearchUrl(params: JobSearchParams): string {
  const url = new URL(`${BASE_URL}/jobs-guest/jobs/api/seeMoreJobPostings/search`);
  const keywords = buildKeywords(params);
  if (keywords) url.searchParams.set("keywords", keywords);
  if (params.location) {
    url.searchParams.set("location", `${params.location}, Deutschland`);
    url.searchParams.set("distance", "25");
  } else {
    url.searchParams.set("location", "Deutschland");
    url.searchParams.set("geoId", GERMANY_GEO_ID);
  }
  // f_E: 1 = internship, 2 = entry level.
  if (params.type === "internship") url.searchParams.set("f_E", "1");
  if (params.type === "entry") url.searchParams.set("f_E", "2");
  url.searchParams.set("f_TPR", "r2592000"); // last 30 days
  url.searchParams.set("start", "0");
  return url.toString();
}

function jobIdFrom(urn: string | undefined, href: string | undefined): string | null {
  const fromUrn = urn?.match(/jobPosting:(\d+)/)?.[1];
  if (fromUrn) return fromUrn;
  return href?.match(/-(\d{6,})(?:[/?]|$)/)?.[1] ?? null;
}

export function parseSearchPage(html: string): JobPostingDraft[] {
  const $ = load(html);
  const cards = $("[data-entity-urn*='jobPosting'], .job-search-card");
  if (cards.length === 0) {
    if (!html.trim()) return [];
    if (looksLikeBotChallenge(html)) throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
    return [];
  }

  const drafts: JobPostingDraft[] = [];
  cards.each((_, element) => {
    const card = $(element);
    const href = card.find("a.base-card__full-link").attr("href") ?? card.find("a").first().attr("href");
    const id = jobIdFrom(card.attr("data-entity-urn"), href);
    const title = cleanLine(card.find(".base-search-card__title").text());
    if (!id || !title) return;
    drafts.push({
      source: "linkedin",
      sourceId: id,
      sourceUrl: `${BASE_URL}/jobs/view/${id}`,
      title,
      company: cleanLine(card.find(".base-search-card__subtitle").text()),
      location: cleanLine(card.find(".job-search-card__location").text()),
      track: null,
      employmentType: null,
      description: "",
      publishedAt: toIsoDate(card.find("time").attr("datetime")),
      insights: emptyInsights(),
    });
  });
  return drafts;
}

// "71 Bewerbungen", "Mehr als 200 Bewerber:innen", "Gehören Sie zu den ersten 25 Bewerber:innen."
export function parseApplicants(text: string | null): Pick<JobInsights, "applicantCount" | "applicantText"> {
  const applicantText = cleanLine(text);
  if (!applicantText) return { applicantCount: null, applicantText: null };
  const number = applicantText.match(/(\d[\d.]*)/)?.[1];
  // "first 25" means fewer applicants than that, so there is no exact count.
  const count = number && !/ersten|first/i.test(applicantText) ? Number(number.replace(/\./g, "")) : null;
  return { applicantCount: Number.isFinite(count) ? count : null, applicantText };
}

export function parseDetailPage(html: string): JobDetails | null {
  const $ = load(html);
  const markup = $(".show-more-less-html__markup").first().html() ?? $(".description__text").first().html();
  const applicants = parseApplicants(
    $(".num-applicants__caption").first().text() || $(".num-applicants__figure").first().text() || null,
  );
  if (!markup && !applicants.applicantText) return null;
  return { description: markup ? htmlToText(markup) || null : null, insights: applicants };
}

export const linkedinSource: JobSource = {
  id: "linkedin",
  label: "LinkedIn",
  kind: "scraped",
  isEnabled: scrapedSourcesEnabled,
  async search(params, { signal }) {
    return parseSearchPage(await fetchHtml(buildSearchUrl(params), { signal }));
  },
  async fetchDetails({ sourceId }, { signal }) {
    if (!/^\d+$/.test(sourceId)) return null;
    const html = await fetchHtml(`${BASE_URL}/jobs-guest/jobs/api/jobPosting/${sourceId}`, { signal });
    const details = parseDetailPage(html);
    if (!details && looksLikeBotChallenge(html)) throw new SourceError("Quelle hat die Anfrage blockiert", "blocked");
    return details;
  },
};
