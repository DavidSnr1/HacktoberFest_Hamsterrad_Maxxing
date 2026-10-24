export type SupabasePublicEnv = {
  url: string;
  anonKey: string;
};

/**
 * Returns the public Supabase config, or null if it is not set yet.
 * The app stays usable without it and shows a setup hint instead of crashing.
 * Next.js only inlines NEXT_PUBLIC_* vars when they are accessed literally.
 */
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  return { url, anonKey };
}
