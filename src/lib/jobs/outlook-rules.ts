import type { CompetitionLevel, JobInsights, JobOutlook } from "@/lib/schemas/job-posting";

export type OutlookEstimate = {
  applyMonthsBefore: { min: number; max: number };
  applicationPeriod: string | null;
  competition: CompetitionLevel;
  hint: string;
};

const HIGH_APPLICANTS = 100;
const MEDIUM_APPLICANTS = 30;
// Postings that go online shortly before the start ("ab sofort") say nothing about lead time.
const MIN_MEANINGFUL_LEAD_MONTHS = 2;

export function competitionFromInsights(insights: JobInsights): CompetitionLevel | null {
  if (insights.applicantCount !== null) {
    if (insights.applicantCount >= HIGH_APPLICANTS) return "high";
    if (insights.applicantCount >= MEDIUM_APPLICANTS) return "medium";
    return "low";
  }
  if (insights.applicantText && /ersten|first/i.test(insights.applicantText)) return "low";
  return null;
}

// Whole months between publication and desired start, if the posting went online clearly ahead of time.
export function observedLeadMonths(publishedAt: string | null, startDate: string | null): number | null {
  if (!publishedAt || !startDate) return null;
  const published = new Date(publishedAt);
  const start = new Date(startDate);
  if (Number.isNaN(published.getTime()) || Number.isNaN(start.getTime())) return null;
  const months = (start.getUTCFullYear() - published.getUTCFullYear()) * 12 + start.getUTCMonth() - published.getUTCMonth();
  return months >= MIN_MEANINGFUL_LEAD_MONTHS ? months : null;
}

// Portal data wins; the estimate fills the gaps.
export function combineOutlook(
  facts: { insights: JobInsights; publishedAt: string | null },
  estimate: OutlookEstimate | null,
): JobOutlook {
  const lead = observedLeadMonths(facts.publishedAt, facts.insights.startDate);
  return {
    applyMonthsBefore: lead !== null ? { min: lead, max: lead } : (estimate?.applyMonthsBefore ?? null),
    applicationPeriod: estimate?.applicationPeriod ?? null,
    competition: competitionFromInsights(facts.insights) ?? estimate?.competition ?? null,
    applicantCount: facts.insights.applicantCount,
    hint: estimate?.hint ?? null,
  };
}
