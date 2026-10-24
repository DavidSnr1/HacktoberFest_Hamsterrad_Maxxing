import "server-only";

import { z } from "zod";

import { emptyInsights, type EmploymentType, type JobPostingDraft, type JobSearchParams } from "@/lib/schemas/job-posting";
import { fetchJson, SourceError } from "../http";
import { buildKeywords } from "../normalize";
import { cleanLine, htmlToText, toIsoDate } from "../text";
import type { JobDetails, JobSource } from "./types";

// Public job search API of the Bundesagentur für Arbeit, documented at https://jobsuche.api.bund.dev.
const BASE_URL = "https://rest.arbeitsagentur.de/jobboerse/jobsuche-service";
const API_HEADERS = { "X-API-Key": "jobboerse-jobsuche" };
const PAGE_SIZE = 25;

// angebotsart: 1 = Arbeit, 34 = Praktikum/Trainee.
const ANGEBOTSART: Partial<Record<EmploymentType, string>> = {
  internship: "34",
};

const searchItemSchema = z.object({
  referenznummer: z.string(),
  stellenangebotsTitel: z.string(),
  stellenangebotsart: z.string().optional(),
  firma: z.string().optional(),
  stellenlokationen: z
    .array(z.object({ adresse: z.object({ ort: z.string().optional(), plz: z.string().optional() }).optional() }))
    .optional(),
  datumErsteVeroeffentlichung: z.string().optional(),
  veroeffentlichungszeitraum: z.object({ von: z.string().optional() }).optional(),
  eintrittszeitraum: z.object({ von: z.string().optional() }).optional(),
});

const searchResponseSchema = z.object({
  ergebnisliste: z.array(z.unknown()).optional(),
});

const detailSchema = z.object({
  stellenangebotsBeschreibung: z.string().optional(),
});

export function jobDetailUrl(referenznummer: string): string {
  return `https://www.arbeitsagentur.de/jobsuche/jobdetail/${encodeURIComponent(referenznummer)}`;
}

export function buildSearchUrl(params: JobSearchParams): string {
  const url = new URL(`${BASE_URL}/pc/v6/jobs`);
  // BA filters internships via angebotsart, so the keyword is only needed for other types.
  const keywords = buildKeywords(params.type === "internship" ? { ...params, type: undefined } : params);
  if (keywords) url.searchParams.set("was", keywords);
  if (params.location) {
    url.searchParams.set("wo", params.location);
    url.searchParams.set("umkreis", "25");
  }
  url.searchParams.set("angebotsart", (params.type && ANGEBOTSART[params.type]) ?? "1");
  url.searchParams.set("veroeffentlichtseit", "60");
  url.searchParams.set("page", "1");
  url.searchParams.set("size", String(PAGE_SIZE));
  return url.toString();
}

export function parseSearchResponse(data: unknown): JobPostingDraft[] {
  const parsed = searchResponseSchema.safeParse(data);
  if (!parsed.success) throw new SourceError("Unerwartetes Antwortformat", "parse");

  const drafts: JobPostingDraft[] = [];
  for (const raw of parsed.data.ergebnisliste ?? []) {
    const item = searchItemSchema.safeParse(raw);
    if (!item.success) continue;
    const job = item.data;
    const places = [...new Set((job.stellenlokationen ?? []).map((l) => l.adresse?.ort).filter(Boolean))];
    drafts.push({
      source: "arbeitsagentur",
      sourceId: job.referenznummer,
      sourceUrl: jobDetailUrl(job.referenznummer),
      title: cleanLine(job.stellenangebotsTitel) ?? job.stellenangebotsTitel,
      company: cleanLine(job.firma),
      location: places.length ? places.join(", ") : null,
      track: null,
      employmentType: job.stellenangebotsart === "PRAKTIKUM_TRAINEE" ? "internship" : null,
      description: "",
      publishedAt: toIsoDate(job.datumErsteVeroeffentlichung ?? job.veroeffentlichungszeitraum?.von),
      insights: { ...emptyInsights(), startDate: toIsoDate(job.eintrittszeitraum?.von) },
    });
  }
  return drafts;
}

export function parseDetailResponse(data: unknown): JobDetails | null {
  const parsed = detailSchema.safeParse(data);
  if (!parsed.success || !parsed.data.stellenangebotsBeschreibung) return null;
  // Mostly plain text, but may contain entities and occasional tags.
  return { description: htmlToText(parsed.data.stellenangebotsBeschreibung) || null };
}

export const arbeitsagenturSource: JobSource = {
  id: "arbeitsagentur",
  label: "Bundesagentur für Arbeit",
  kind: "official",
  isEnabled: () => true,
  async search(params, { signal }) {
    const data = await fetchJson(buildSearchUrl(params), { signal, headers: API_HEADERS });
    return parseSearchResponse(data);
  },
  async fetchDetails({ sourceId }, { signal }) {
    const encoded = Buffer.from(sourceId, "utf8").toString("base64");
    const data = await fetchJson(`${BASE_URL}/pc/v4/jobdetails/${encoded}`, { signal, headers: API_HEADERS });
    return parseDetailResponse(data);
  },
};
