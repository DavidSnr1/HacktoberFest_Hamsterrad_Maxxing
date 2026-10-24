import "server-only";

import { z } from "zod";

import type { JobTrack } from "@/lib/schemas/job-posting";
import { getJobPosting } from "./search";

// Interface for feature A (TEAM-KONTEXT 5.2): one job posting as plain text for resume tailoring.
// `track` is an addition on top of 5.2 – feature A keeps one resume per track and uses it to pick one.
export async function getJobPostingText(id: string): Promise<{
  title: string;
  company: string | null;
  sourceUrl: string;
  text: string;
  track: JobTrack | null;
} | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const posting = await getJobPosting(id);
  if (!posting) return null;

  const text = [
    posting.title,
    posting.company ? `Unternehmen: ${posting.company}` : null,
    posting.location ? `Ort: ${posting.location}` : null,
    posting.description,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { title: posting.title, company: posting.company, sourceUrl: posting.sourceUrl, text, track: posting.track };
}
