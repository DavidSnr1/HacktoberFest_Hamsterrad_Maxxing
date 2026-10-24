import "server-only";

import { userClient } from "./db";

const WINDOW_MS = 60_000;
const MAX_SEARCHES_PER_WINDOW = 10;

// Counts the user's searches in the database (works across serverless instances) and logs this one.
// Returns false when the limit is reached.
export async function consumeSearchQuota(): Promise<boolean> {
  const supabase = await userClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();
  const { count, error } = await supabase
    .from("job_search_events")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  if (error) throw new Error("job_search_events count failed");
  if ((count ?? 0) >= MAX_SEARCHES_PER_WINDOW) return false;

  const { error: insertError } = await supabase.from("job_search_events").insert({});
  if (insertError) throw new Error("job_search_events insert failed");
  return true;
}
