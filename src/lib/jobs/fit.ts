import type { EmploymentType, JobPosting, JobTrack } from "@/lib/schemas/job-posting";
import { observedLeadMonths } from "./outlook-rules";
import type { JobPreferences } from "./profile";

// How well a posting matches the user's profile. Pure functions, safe to use on the client.

export type FitReason =
  | { kind: "track"; track: JobTrack }
  | { kind: "type"; type: EmploymentType }
  | { kind: "location"; location: string }
  | { kind: "remote" }
  | { kind: "start"; start: string; earliestStart: string } // start is "YYYY-MM"
  | { kind: "skills"; skills: string[] };

export type JobFit = {
  score: number;
  matches: FitReason[];
  warnings: FitReason[]; // currently: posting starts before the user's earliest start
};

const WEIGHTS = { track: 3, type: 3, location: 2, remote: 1, start: 1, earlyStart: -3, skill: 1 } as const;
const MAX_SKILL_MATCHES = 2;

function normalizePlace(value: string): string {
  return value.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
}

// "Frankfurt am Main" also matches "Frankfurt"; short first words ("Bad …") need the full name.
function matchesPlace(postingLocation: string, preferred: string): boolean {
  const haystack = normalizePlace(postingLocation);
  const name = normalizePlace(preferred).trim();
  const firstWord = name.split(/[\s,(/-]+/)[0] ?? "";
  return haystack.includes(name) || (firstWord.length >= 5 && haystack.includes(firstWord));
}

function looksRemote(location: string): boolean {
  return /remote|home ?-?office/.test(location.toLowerCase());
}

function containsWord(text: string, word: string): boolean {
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "iu").test(text);
}

// Start month only counts if it is a real start date, not "ab sofort" (BA often uses the publication date).
function explicitStartMonth(posting: JobPosting): string | null {
  const start = posting.insights.startDate;
  if (!start) return null;
  if (posting.publishedAt && observedLeadMonths(posting.publishedAt, start) === null) return null;
  return start.slice(0, 7);
}

export function computeFit(posting: JobPosting, preferences: JobPreferences): JobFit {
  const matches: FitReason[] = [];
  const warnings: FitReason[] = [];
  let score = 0;

  if (posting.track && preferences.tracks.includes(posting.track)) {
    score += WEIGHTS.track;
    matches.push({ kind: "track", track: posting.track });
  }
  if (posting.employmentType && (preferences.types as EmploymentType[]).includes(posting.employmentType)) {
    score += WEIGHTS.type;
    matches.push({ kind: "type", type: posting.employmentType });
  }

  const location = posting.location ?? "";
  const place = preferences.locations.find((preferred) => matchesPlace(location, preferred));
  if (place) {
    score += WEIGHTS.location;
    matches.push({ kind: "location", location: place });
  } else if (preferences.remoteOk && looksRemote(location)) {
    score += WEIGHTS.remote;
    matches.push({ kind: "remote" });
  }

  const start = explicitStartMonth(posting);
  if (start && preferences.earliestStart) {
    if (start >= preferences.earliestStart) {
      score += WEIGHTS.start;
      matches.push({ kind: "start", start, earliestStart: preferences.earliestStart });
    } else {
      score += WEIGHTS.earlyStart;
      warnings.push({ kind: "start", start, earliestStart: preferences.earliestStart });
    }
  }

  const text = `${posting.title}\n${posting.description}`;
  const skills = preferences.skills.filter((skill) => containsWord(text, skill)).slice(0, MAX_SKILL_MATCHES);
  if (skills.length) {
    score += skills.length * WEIGHTS.skill;
    matches.push({ kind: "skills", skills });
  }

  return { score, matches, warnings };
}

// Best fit first; equal scores keep their order (newest first from the search).
export function rankByFit<T extends { id: string }>(postings: T[], fits: Map<string, JobFit>): T[] {
  return [...postings].sort((a, b) => (fits.get(b.id)?.score ?? 0) - (fits.get(a.id)?.score ?? 0));
}

export type ApplyWindow = {
  start: string; // the user's earliest start, "YYYY-MM"
  from: string; // "YYYY-MM"
  to: string; // "YYYY-MM"
  status: "early" | "now" | "late";
};

function addMonths(month: string, delta: number): string {
  const [year = 0, monthNumber = 1] = month.split("-").map(Number);
  const total = year * 12 + (monthNumber - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}

// When to apply for the user's own start date, given how many months ahead such roles are filled.
export function personalApplyWindow(
  earliestStart: string | null,
  applyMonthsBefore: { min: number; max: number } | null,
  today: Date,
): ApplyWindow | null {
  if (!earliestStart || !applyMonthsBefore) return null;
  const from = addMonths(earliestStart, -applyMonthsBefore.max);
  const to = addMonths(earliestStart, -applyMonthsBefore.min);
  const now = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return { start: earliestStart, from, to, status: now < from ? "early" : now > to ? "late" : "now" };
}
