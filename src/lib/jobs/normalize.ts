import {
  jobPostingDraftSchema,
  type EmploymentType,
  type JobPostingDraft,
  type JobSearchParams,
  type JobTrack,
} from "@/lib/schemas/job-posting";

const EMPLOYMENT_PATTERNS: [Exclude<EmploymentType, "other">, RegExp][] = [
  ["working_student", /werkstudent|working student|studentische (hilfskraft|aushilfe|mitarbeit)/i],
  ["internship", /praktik|\bintern(ship)?\b|pflichtpraktikum|abschlussarbeit|masterarbeit|bachelorarbeit/i],
  ["entry", /\bjunior\b|trainee|absolvent|berufseinst|einsteiger|graduate|entry[ -]level|young professional/i],
];

const TRACK_PATTERNS: [JobTrack, RegExp][] = [
  ["startup", /start-?up|founders?'? ?associate|venture build|gründer|early[ -]stage|scale-?up|series [ab]\b/i],
  ["consulting", /consult|beratung|berater|advisory|strategy|strategie/i],
  [
    "finance",
    /financ|finanz|\bbank|investment|private equity|venture capital|m&a|controlling|audit|wirtschaftsprüf|asset management|treasury|accounting|rechnungswesen/i,
  ],
];

// Words we add to a source query when the user picks a type but no matching word is in the query.
const TYPE_KEYWORDS: Record<Exclude<EmploymentType, "other">, string> = {
  internship: "Praktikum",
  working_student: "Werkstudent",
  entry: "Junior",
};

const TRACK_KEYWORDS: Record<JobTrack, string> = {
  startup: "Startup",
  consulting: "Consulting",
  finance: "Finance",
};

export function detectEmploymentType(title: string): EmploymentType | null {
  for (const [type, pattern] of EMPLOYMENT_PATTERNS) {
    if (pattern.test(title)) return type;
  }
  return null;
}

export function detectTrack(...texts: (string | null | undefined)[]): JobTrack | null {
  const haystack = texts.filter(Boolean).join(" \n ");
  for (const [track, pattern] of TRACK_PATTERNS) {
    if (pattern.test(haystack)) return track;
  }
  return null;
}

// Free-text keywords for sources that only support a single search field.
export function buildKeywords(params: JobSearchParams): string {
  const parts: string[] = [];
  if (params.q) parts.push(params.q);
  if (params.type && !(params.q && EMPLOYMENT_PATTERNS.find(([type]) => type === params.type)?.[1].test(params.q))) {
    parts.push(TYPE_KEYWORDS[params.type]);
  }
  if (!params.q && params.track) parts.push(TRACK_KEYWORDS[params.track]);
  return parts.join(" ").trim();
}

// Crude stemming so "Consulting" also matches "Consultant" and "Beratung" matches "Berater".
function stem(term: string): string {
  const stemmed = term.replace(/(ing|ungen|ung|innen|in|en|er|e|s)$/, "");
  return stemmed.length >= 4 ? stemmed : term;
}

// True if every word of the query (2+ characters) occurs in the text, case-insensitive.
export function matchesQuery(text: string, query: string): boolean {
  const haystack = text.toLowerCase();
  return query
    .toLowerCase()
    .split(/[\s,/]+/)
    .filter((term) => term.length >= 2)
    .every((term) => haystack.includes(stem(term)));
}

// Validates an adapter result and fills in heuristic fields. Returns null for unusable entries.
export function finalizeDraft(raw: JobPostingDraft): JobPostingDraft | null {
  const parsed = jobPostingDraftSchema.safeParse(raw);
  if (!parsed.success) return null;
  const draft = parsed.data;
  return {
    ...draft,
    // The title is more precise than source categories (BA lists working students under "Praktikum/Trainee").
    employmentType: detectEmploymentType(draft.title) ?? draft.employmentType,
    track: draft.track ?? detectTrack(draft.title, draft.company, draft.description.slice(0, 1500)),
  };
}

export function matchesFilters(posting: Pick<JobPostingDraft, "track" | "employmentType">, params: JobSearchParams): boolean {
  if (params.type && posting.employmentType !== params.type) return false;
  if (params.track && posting.track !== params.track) return false;
  return true;
}

function simplify(value: string | null): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\((m|w|d|f|x|all genders?|gn\*?)[^)]*\)/g, "")
    .replace(/\b(gmbh|ag|se|kg|co|ug|mbh|inc|ltd)\b/g, "")
    .replace(/[^a-z0-9äöüß]+/g, " ")
    .trim();
}

// Same job posted on several portals: same company, title and first location.
export function dedupeKey(posting: Pick<JobPostingDraft, "title" | "company" | "location">): string {
  const firstLocation = (posting.location ?? "").split(/[,;/]/)[0] ?? "";
  return [simplify(posting.company), simplify(posting.title), simplify(firstLocation)].join("|");
}
