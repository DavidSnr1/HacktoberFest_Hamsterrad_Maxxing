import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

/** Supabase client for Client Components. Returns null if Supabase is not configured. */
export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) return null;
  return createBrowserClient<Database>(env.url, env.anonKey);
}
