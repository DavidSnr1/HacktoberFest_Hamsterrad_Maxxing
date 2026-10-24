import { z } from "zod";

export const JOB_TRACKS = ["startup", "consulting", "finance"] as const;
export const EMPLOYMENT_TYPES = ["internship", "working_student", "entry", "other"] as const;

export const jobTrackSchema = z.enum(JOB_TRACKS);
export const employmentTypeSchema = z.enum(EMPLOYMENT_TYPES);

export type JobTrack = z.infer<typeof jobTrackSchema>;
export type EmploymentType = z.infer<typeof employmentTypeSchema>;

// Extra facts some portals provide. Every field is optional so stored rows and partial updates parse.
export const jobInsightsSchema = z.object({
  startDate: z.string().nullable().default(null), // desired start (ISO date)
  validThrough: z.string().nullable().default(null), // listing expiry, not an application deadline
  salary: z
    .object({
      min: z.number().nullable(),
      max: z.number().nullable(),
      currency: z.string(),
      period: z.enum(["year", "month", "hour"]),
    })
    .nullable()
    .default(null),
  applicantCount: z.number().int().nonnegative().nullable().default(null),
  applicantText: z.string().nullable().default(null), // e.g. "Gehören Sie zu den ersten 25 Bewerber:innen."
  noCoverLetter: z.boolean().default(false),
  quickApply: z.boolean().default(false),
});
export type JobInsights = z.infer<typeof jobInsightsSchema>;

export function emptyInsights(): JobInsights {
  return jobInsightsSchema.parse({});
}

// Shared format between feature C (jobs) and feature A (resume), see TEAM-KONTEXT 5.2.
// `employmentType` and `insights` are additions on top of 5.2; feature A does not depend on them.
export const jobPostingSchema = z.object({
  id: z.uuid(), // internal id (job_postings.id)
  source: z.string(), // e.g. "arbeitsagentur", "arbeitnow"
  sourceUrl: z.url(), // link to the original posting
  title: z.string(),
  company: z.string().nullable(),
  location: z.string().nullable(),
  track: jobTrackSchema.nullable(),
  employmentType: employmentTypeSchema.nullable(),
  description: z.string(), // plain text, no HTML; may be empty until details are loaded
  publishedAt: z.string().nullable(), // ISO date
  insights: jobInsightsSchema,
});
export type JobPosting = z.infer<typeof jobPostingSchema>;

export const COMPETITION_LEVELS = ["low", "medium", "high"] as const;
export type CompetitionLevel = (typeof COMPETITION_LEVELS)[number];

// Application timing and competition for one posting. Values are portal data where available,
// otherwise estimates; the UI presents both the same way (as approximate values).
export const jobOutlookSchema = z.object({
  applyMonthsBefore: z.object({ min: z.number().int(), max: z.number().int() }).nullable(),
  applicationPeriod: z.string().nullable(), // e.g. "laufend" or "Oktober bis Januar"
  competition: z.enum(COMPETITION_LEVELS).nullable(),
  applicantCount: z.number().int().nullable(),
  hint: z.string().nullable(),
});
export type JobOutlook = z.infer<typeof jobOutlookSchema>;

// Example postings the Indeed adapter returns while Indeed blocks automated requests. Not real jobs.
export const INDEED_DEMO_SOURCE = "indeed-demo";

export function isDemoSource(source: string): boolean {
  return source === INDEED_DEMO_SOURCE;
}

// What a source adapter returns: no internal id yet, but the source's own id.
export const jobPostingDraftSchema = jobPostingSchema.omit({ id: true }).extend({
  sourceId: z.string().min(1),
  title: z.string().min(1),
});
export type JobPostingDraft = z.infer<typeof jobPostingDraftSchema>;

// Empty or whitespace-only strings count as "not given".
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().trim().max(max).optional(),
  );

export const jobSearchParamsSchema = z.object({
  q: optionalText(120),
  location: optionalText(80),
  track: jobTrackSchema.optional(),
  type: employmentTypeSchema.exclude(["other"]).optional(),
});
export type JobSearchParams = z.infer<typeof jobSearchParamsSchema>;

export const sourceStatusSchema = z.object({
  id: z.string(),
  label: z.string(),
  ok: z.boolean(),
  count: z.number().int(),
  error: z.string().optional(),
});
export type SourceStatus = z.infer<typeof sourceStatusSchema>;

export type JobSearchResult = {
  postings: JobPosting[];
  sources: SourceStatus[];
  cached: boolean;
};
