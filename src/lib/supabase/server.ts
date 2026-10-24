import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { cache } from "react";
import "server-only";
import type { Database } from "./database.types";
import { getSupabasePublicEnv } from "./env";

/**
 * Supabase client for Server Components, Route Handlers and Server Actions.
 * Returns null if Supabase is not configured.
 */
export async function createClient() {
  // Supabase reads the clock (token expiry) and per-user data, so everything
  // using this client is request-time work and must not be prerendered.
  await connection();
  const cookieStore = await cookies();
  const env = getSupabasePublicEnv();
  if (!env) return null;

  return createServerClient<Database>(env.url, env.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only.
          // The proxy refreshes the session, so this can be ignored.
        }
      },
    },
  });
}

export type CurrentUser = { id: string; email: string | null };

/**
 * Returns the signed-in user's id and email, verified via the JWT, or null.
 * Deduplicated per request, so several components can call it.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
});
