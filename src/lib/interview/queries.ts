import "server-only";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

/** Loads one of the current user's interviews (RLS-scoped), or null. */
export async function getInterview(id: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const supabase = await createClient();
  if (!supabase) return null;

  const { data } = await supabase
    .from("interviews")
    .select("id, track, status, started_at, finished_at, duration_seconds, transcript")
    .eq("id", id)
    .maybeSingle();
  return data;
}
