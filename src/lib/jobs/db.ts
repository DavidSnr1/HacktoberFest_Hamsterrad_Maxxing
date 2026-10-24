import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// The shared factories return null when Supabase is not configured; job search cannot work without it.

/** Client acting as the signed-in user, so RLS applies. */
export async function userClient() {
  const supabase = await createClient();
  if (!supabase) throw new Error("Supabase is not configured");
  return supabase;
}

/** Service-role client for the public caches (job_postings, job_search_cache, job_outlook_cache). */
export function adminClient() {
  const admin = createAdminClient();
  if (!admin) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return admin;
}
