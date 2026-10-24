import { createHash } from "node:crypto";

import {
  emptyInsights,
  INDEED_DEMO_SOURCE,
  type EmploymentType,
  type JobPostingDraft,
  type JobSearchParams,
  type JobTrack,
} from "@/lib/schemas/job-posting";
import { detectEmploymentType, detectTrack } from "../normalize";

// Example postings shown while Indeed blocks our requests (see indeed.ts). They are deterministic per
// query, use placeholder companies ("Muster …") and are stored under their own source id, so the UI
// can label them as examples and never loads an Indeed detail page for them.
const MOCK_COUNT = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

type MockType = Exclude<EmploymentType, "other">;

const TYPE_ROTATION: MockType[] = ["internship", "working_student", "entry"];
const LOCATIONS = ["Berlin", "München", "Frankfurt am Main", "Hamburg", "Köln"];

// One company per posting (MOCK_COUNT), so postings with the same title are not merged as duplicates.
const COMPANIES: Record<JobTrack | "none", string[]> = {
  consulting: [
    "Muster Consulting GmbH",
    "Mustermann & Partner Strategieberatung",
    "Muster Advisory AG",
    "Muster Strategy Partners",
    "Musterberatung GmbH",
  ],
  finance: [
    "Musterbank AG",
    "Muster Capital Partners GmbH",
    "Muster Asset Management GmbH",
    "Muster Finanz AG",
    "Muster Corporate Finance GmbH",
  ],
  startup: ["Muster Labs GmbH", "Musterkiez Tech GmbH", "Muster Ventures Studio GmbH", "Muster Mobility GmbH", "Musterapp GmbH"],
  none: ["Muster Gruppe", "Muster Digital GmbH", "Muster Industries AG", "Muster Handel GmbH", "Muster Logistik AG"],
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

export function buildMockResults(params: JobSearchParams, searchUrl: string, now = new Date()): JobPostingDraft[] {
  // Without filters, take type and track from the query ("Praktikum Consulting").
  const queryType = params.q ? detectEmploymentType(params.q) : null;
  const track = params.track ?? (params.q ? detectTrack(params.q) : null) ?? "none";
  const focuses = focusFrom(params.q, track);
  const companies = COMPANIES[track];
  const hash = queryHash(params);
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

  return Array.from({ length: MOCK_COUNT }, (_, index) => {
    const type = params.type ?? (queryType && queryType !== "other" ? queryType : TYPE_ROTATION[index % TYPE_ROTATION.length]!);
    const focus = focuses[index % focuses.length]!;
    const company = companies[index % companies.length]!;
    const location = params.location ?? LOCATIONS[index % LOCATIONS.length]!;
    return {
      source: INDEED_DEMO_SOURCE,
      sourceId: `${hash}-${index}`,
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
