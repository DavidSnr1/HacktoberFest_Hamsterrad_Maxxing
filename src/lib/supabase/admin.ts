import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Service-role client that bypasses RLS. Server only, and only for writes
 * users must not do themselves (feedback, XP). Always scope queries to a
 * user id that was verified from the session first.
 */
export function createAdminClient() {
  const env = getSupabasePublicEnv();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !serviceRoleKey) return null;

  return createClient<Database>(env.url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
