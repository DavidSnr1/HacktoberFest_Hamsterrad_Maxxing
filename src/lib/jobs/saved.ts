import "server-only";

import type { JobPosting } from "@/lib/schemas/job-posting";
import { userClient } from "./db";
import { JOB_POSTING_COLUMNS, rowToPosting } from "./repository";

// All reads and writes run as the user, so RLS limits them to the user's own rows.

export async function listSavedJobs(): Promise<JobPosting[]> {
  const supabase = await userClient();
  const { data: saved, error } = await supabase
    .from("saved_jobs")
    .select("job_id")
    .order("created_at", { ascending: false });
  if (error) throw new Error("saved_jobs select failed");
  const ids = (saved ?? []).map((row) => row.job_id);
  if (ids.length === 0) return [];

  const { data: rows, error: postingsError } = await supabase
    .from("job_postings")
    .select(JOB_POSTING_COLUMNS)
    .in("id", ids);
  if (postingsError) throw new Error("job_postings select failed");
  const byId = new Map((rows ?? []).map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    const posting = row ? rowToPosting(row) : null;
    return posting ? [posting] : [];
  });
}

export async function saveJob(jobId: string): Promise<"saved" | "not_found"> {
  const supabase = await userClient();
  const { data: posting } = await supabase.from("job_postings").select("id").eq("id", jobId).maybeSingle();
  if (!posting) return "not_found";
  const { error } = await supabase
    .from("saved_jobs")
    .upsert({ job_id: jobId }, { onConflict: "user_id,job_id", ignoreDuplicates: true });
  if (error) throw new Error("saved_jobs insert failed");
  return "saved";
}

export async function unsaveJob(jobId: string): Promise<void> {
  const supabase = await userClient();
  const { error } = await supabase.from("saved_jobs").delete().eq("job_id", jobId);
  if (error) throw new Error("saved_jobs delete failed");
}
