"use server";

import { z } from "zod";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { MILESTONES } from "./milestones";
import { getCurrentLevel } from "./server";
import { awardXp } from "./xp";

export type ActionResult = { ok: true } | { ok: false; error: string };

const claimableIds = MILESTONES.filter((m) => m.source === "claim").map((m) => m.id);

/** The user confirms a milestone the profile cannot hold (Spring Week, offer). Once per user. */
export async function claimMilestone(id: unknown): Promise<ActionResult> {
  const parsed = z.enum(claimableIds as [string, ...string[]]).safeParse(id);
  const milestone = parsed.success ? MILESTONES.find((m) => m.id === parsed.data) : undefined;
  if (!milestone) return { ok: false, error: "Ungültige Anfrage." };

  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Bitte melde dich erneut an." };

  const awarded = await awardXp(user.id, "milestone", milestone.xp, milestone.refId);
  return awarded ? { ok: true } : { ok: false, error: "Der Meilenstein konnte nicht gespeichert werden." };
}

/**
 * Remembers that the current level was shown (and celebrated). The level is
 * computed on the server, so the browser cannot store a different one.
 */
export async function markLevelSeen(): Promise<ActionResult> {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return { ok: false, error: "Bitte melde dich erneut an." };

  const level = await getCurrentLevel();
  if (level === null) return { ok: false, error: "Dein Level konnte nicht gelesen werden." };

  const { error } = await supabase.from("profiles").update({ last_seen_level: level }).eq("id", user.id);
  if (error) {
    console.error("character: storing last seen level failed", error.code);
    return { ok: false, error: "Dein Level konnte nicht gespeichert werden." };
  }
  return { ok: true };
}
