import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";

import { generateJson } from "@/lib/llm";
import { buildJobOutlookPrompt, JOB_OUTLOOK_SYSTEM } from "@/lib/prompts/job-outlook";
import { COMPETITION_LEVELS, type JobOutlook, type JobPosting } from "@/lib/schemas/job-posting";
import { adminClient } from "./db";
import { combineOutlook, type OutlookEstimate } from "./outlook-rules";

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

const months = z.number().int().min(0).max(24);
const estimateSchema = z.object({
  applyMonthsBefore: z.object({ min: months, max: months }),
  applicationPeriod: z.string().trim().max(80).nullable(),
  competition: z.enum(COMPETITION_LEVELS),
  hint: z.string().trim().min(1).max(300),
});

// Estimates depend on company and role type, not on the individual posting, so they are shared.
function cacheKey(posting: JobPosting): string {
  const company = (posting.company ?? "").toLowerCase().replace(/\s+/g, " ").trim();
  const parts = [company || posting.title.toLowerCase(), posting.employmentType ?? "", posting.track ?? ""];
  return createHash("sha256").update(parts.join("|")).digest("hex");
}

async function loadEstimate(posting: JobPosting): Promise<OutlookEstimate | null> {
  const admin = adminClient();
  const key = cacheKey(posting);

  const { data: cached } = await admin
    .from("job_outlook_cache")
    .select("outlook, created_at")
    .eq("cache_key", key)
    .maybeSingle();
  if (cached && Date.now() - new Date(cached.created_at).getTime() < CACHE_TTL_MS) {
    const parsed = estimateSchema.safeParse(cached.outlook);
    if (parsed.success) return parsed.data;
  }

  // Only public posting data goes into the prompt, nothing about the user.
  const { data: estimate } = await generateJson(estimateSchema, {
    tier: "live",
    system: JOB_OUTLOOK_SYSTEM,
    prompt: buildJobOutlookPrompt(posting),
    check: (value) =>
      value.applyMonthsBefore.min <= value.applyMonthsBefore.max ? null : "applyMonthsBefore.min must be <= max",
  });
  await admin
    .from("job_outlook_cache")
    .upsert({ cache_key: key, outlook: estimate, created_at: new Date().toISOString() });
  return estimate;
}

export async function getJobOutlook(posting: JobPosting): Promise<JobOutlook> {
  let estimate: OutlookEstimate | null = null;
  try {
    estimate = await loadEstimate(posting);
  } catch {
    // Without an estimate the outlook only contains portal data.
  }
  return combineOutlook({ insights: posting.insights, publishedAt: posting.publishedAt }, estimate);
}
