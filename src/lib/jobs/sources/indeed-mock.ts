import { createHash } from "node:crypto";

import {
  emptyInsights,
  INDEED_DEMO_SOURCE,
  type EmploymentType,
  type JobPostingDraft,
  type JobSearchParams,
  type JobTrack,
} from "@/lib/schemas/job-posting";
import { mergeResults } from "../merge";
import { detectEmploymentType, detectTrack } from "../normalize";
import { jobsDemoMode } from "./flags";

// Example postings shown while Indeed blocks our requests (see indeed.ts) and to top up short result
// lists (see search.ts). They are deterministic per query, use placeholder companies ("Muster …") and
// are stored under their own source id, so the UI can label them as examples and never loads an Indeed
// detail page for them. Index n always yields the same posting, so both callers share ids.
// Demo mode (JOBS_DEMO_MODE=true, for presentations only) uses fictional but realistic company names
// and the plain "indeed" source, so the examples look like ordinary results.
const MAX_COUNT = 10;
// Lets the Indeed adapter recognise demo-mode examples, which are stored under source "indeed".
export const DEMO_ID_PREFIX = "demo-";
const DAY_MS = 24 * 60 * 60 * 1000;

type MockType = Exclude<EmploymentType, "other">;

const TYPE_ROTATION: MockType[] = ["internship", "working_student", "entry"];
const LOCATIONS = ["Berlin", "München", "Frankfurt am Main", "Hamburg", "Köln"];

// One company per posting (MAX_COUNT), so postings with the same title are not merged as duplicates.
const COMPANIES: Record<JobTrack | "none", string[]> = {
  consulting: [
    "Muster Consulting GmbH",
    "Mustermann & Partner Strategieberatung",
    "Muster Advisory AG",
    "Muster Strategy Partners",
    "Musterberatung GmbH",
    "Muster Management Consultants",
    "Muster Transformation GmbH",
    "Muster Operations Advisory",
    "Muster Public Sector Beratung",
    "Muster Insights GmbH",
  ],
  finance: [
    "Musterbank AG",
    "Muster Capital Partners GmbH",
    "Muster Asset Management GmbH",
    "Muster Finanz AG",
    "Muster Corporate Finance GmbH",
    "Muster Wirtschaftsprüfung GmbH",
    "Muster Private Equity Partners",
    "Muster Versicherung AG",
    "Muster Treasury Services GmbH",
    "Muster Invest AG",
  ],
  startup: [
    "Muster Labs GmbH",
    "Musterkiez Tech GmbH",
    "Muster Ventures Studio GmbH",
    "Muster Mobility GmbH",
    "Musterapp GmbH",
    "Muster Health Tech GmbH",
    "Muster Climate GmbH",
    "Muster Fintech GmbH",
    "Muster Food Tech GmbH",
    "Muster AI GmbH",
  ],
  none: [
    "Muster Gruppe",
    "Muster Digital GmbH",
    "Muster Industries AG",
    "Muster Handel GmbH",
    "Muster Logistik AG",
    "Muster Energie GmbH",
    "Muster Automotive AG",
    "Muster Medien GmbH",
    "Muster Software GmbH",
    "Muster Pharma AG",
  ],
};

// Fictional names for demo mode. Deliberately no real companies.
const DEMO_COMPANIES: Record<JobTrack | "none", string[]> = {
  consulting: [
    "Corvant Consulting GmbH",
    "Lindqvist & Partner",
    "Haldenberg Strategy Partners",
    "Nexora Advisory AG",
    "Brennwald Management Consultants",
    "Aurelis Consulting GmbH",
    "Tessmar & Co. Strategieberatung",
    "Veltra Partners",
    "Kronfeld Advisory GmbH",
    "Solvaris Beratung GmbH",
  ],
  finance: [
    "Rheinhafen Capital GmbH",
    "Nordkap Asset Management",
    "Talheim Corporate Finance AG",
    "Varenne Investment Partners",
    "Elbstein Privatbank AG",
    "Kestrel Equity Partners",
    "Mainstein Treasury Services",
    "Hollweg Wirtschaftsprüfung GmbH",
    "Severin Capital Partners",
    "Aldmoor Invest AG",
  ],
  startup: [
    "Loopwise GmbH",
    "Fieldnote Labs",
    "Klarwerk GmbH",
    "Peakroute GmbH",
    "Brightbase Technologies",
    "Tandemly GmbH",
    "Nuvio Health GmbH",
    "Greenlane Mobility GmbH",
    "Paylio GmbH",
    "Stacklane AI GmbH",
  ],
  none: [
    "Weidner Gruppe",
    "Novatek Systems GmbH",
    "Bergsdorf Industries AG",
    "Lumio Digital GmbH",
    "Westhoff Logistik AG",
    "Kaltenbach Energie GmbH",
    "Vireo Software GmbH",
    "Altenau Automotive AG",
    "Sandor Medien GmbH",
    "Belmonte Pharma AG",
  ],
};

const DEFAULT_FOCUS: Record<JobTrack | "none", string[]> = {
  consulting: ["Strategy Consulting", "Management Consulting", "Digital Transformation"],
  finance: ["Corporate Finance", "M&A", "Controlling"],
  startup: ["Founders Associate", "Business Development", "Growth"],
  none: ["Business Development", "Projektmanagement", "Marketing"],
};

// Words that only name the kind of job; removed from the query so titles don't repeat them.
const TYPE_WORDS = /\b(praktikum|praktikant(in)?|pflichtpraktikum|intern(ship)?|werkstudent(in)?|working student|junior|trainee|einstieg|berufseinstieg|absolvent(in)?|m\/w\/d)\b/gi;

function focusFrom(query: string | undefined, track: JobTrack | "none"): string[] {
  const fromQuery = query?.replace(TYPE_WORDS, " ").replace(/\s+/g, " ").trim();
  return fromQuery ? [fromQuery] : DEFAULT_FOCUS[track];
}

function titleFor(type: MockType, focus: string): string {
  switch (type) {
    case "internship":
      return `Praktikum ${focus} (m/w/d)`;
    case "working_student":
      return `Werkstudent ${focus} (m/w/d)`;
    case "entry":
      return `Junior ${focus} (m/w/d)`;
  }
}

const TYPE_TEXT: Record<MockType, { intro: string; duration: string }> = {
  internship: { intro: "ein Praktikum", duration: "für 3–6 Monate, Start nach Absprache" },
  working_student: { intro: "eine Werkstudententätigkeit", duration: "mit 15–20 Stunden pro Woche, flexibel neben dem Studium" },
  entry: { intro: "den Berufseinstieg", duration: "in Vollzeit und unbefristet" },
};

function descriptionFor(type: MockType, focus: string, company: string, location: string): string {
  const { intro, duration } = TYPE_TEXT[type];
  return [
    `${company} sucht in ${location} Verstärkung für ${intro} im Bereich ${focus}, ${duration}.`,
    "",
    "Deine Aufgaben",
    `- Du arbeitest im Team an laufenden Projekten im Bereich ${focus} mit.`,
    "- Du recherchierst Markt- und Wettbewerbsdaten und bereitest sie auf.",
    "- Du erstellst Analysen und Präsentationen für interne und externe Termine.",
    "",
    "Dein Profil",
    "- Studium der Wirtschaftswissenschaften oder eines vergleichbaren Fachs",
    "- Sicherer Umgang mit Excel und PowerPoint",
    "- Sehr gute Deutsch- und Englischkenntnisse",
    "",
    "Wir bieten",
    "- Eigene Verantwortung ab dem ersten Tag",
    "- Feste Ansprechperson und regelmäßiges Feedback",
    "- Hybrides Arbeiten",
  ].join("\n");
}

function queryHash(params: JobSearchParams): string {
  const normalized = [params.q, params.location, params.track, params.type].map((value) => value?.toLowerCase() ?? "");
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex").slice(0, 12);
}

export function buildMockResults(
  params: JobSearchParams,
  searchUrl: string,
  count = MAX_COUNT,
  now = new Date(),
  demoMode = jobsDemoMode(),
): JobPostingDraft[] {
  // Without filters, take type and track from the query ("Praktikum Consulting").
  const queryType = params.q ? detectEmploymentType(params.q) : null;
  const track = params.track ?? (params.q ? detectTrack(params.q) : null) ?? "none";
  const focuses = focusFrom(params.q, track);
  const companies = (demoMode ? DEMO_COMPANIES : COMPANIES)[track];
  const hash = queryHash(params);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Array.from({ length: Math.min(count, MAX_COUNT) }, (_, index) => {
    const type = params.type ?? (queryType && queryType !== "other" ? queryType : TYPE_ROTATION[index % TYPE_ROTATION.length]!);
    const focus = focuses[index % focuses.length]!;
    const company = companies[index % companies.length]!;
    const location = params.location ?? LOCATIONS[index % LOCATIONS.length]!;
    return {
      source: demoMode ? "indeed" : INDEED_DEMO_SOURCE,
      sourceId: `${DEMO_ID_PREFIX}${hash}-${index}`,
      sourceUrl: searchUrl,
      title: titleFor(type, focus),
      company,
      location,
      track: params.track ?? null,
      employmentType: type,
      description: descriptionFor(type, focus, company, location),
      publishedAt: new Date(today - index * 2 * DAY_MS).toISOString(),
      insights: emptyInsights(),
    };
  });
}

// Appends example postings after the real ones until there are `min`. The Indeed fallback may already
// have added some; they share ids, so those are skipped.
export function topUpWithExamples(
  drafts: JobPostingDraft[],
  params: JobSearchParams,
  searchUrl: string,
  min: number,
): JobPostingDraft[] {
  if (drafts.length >= min) return drafts;
  const present = new Set(drafts.map((draft) => `${draft.source}|${draft.sourceId}`));
  const examples = mergeResults([buildMockResults(params, searchUrl)], params).filter(
    (draft) => !present.has(`${draft.source}|${draft.sourceId}`),
  );
  return [...drafts, ...examples.slice(0, min - drafts.length)];
}
