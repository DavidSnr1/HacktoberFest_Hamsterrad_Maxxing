"use server";

import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";
import { createClient, getCurrentUser } from "@/lib/supabase/server";
import { CONSENT_POLICY_VERSION } from "./policy";

const grantConsentSchema = z.enum(Constants.public.Enums.consent_type);

export type GrantConsentResult = { ok: true } | { ok: false; error: string };

/** Stores (or renews) the current user's consent for the given type. */
export async function grantConsent(type: unknown): Promise<GrantConsentResult> {
  const parsed = grantConsentSchema.safeParse(type);
  if (!parsed.success) {
    return { ok: false, error: "Ungültige Anfrage." };
  }

  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) {
    return { ok: false, error: "Bitte melde dich erneut an." };
  }

  const { error } = await supabase.from("consents").upsert(
    {
      user_id: user.id,
      type: parsed.data,
      policy_version: CONSENT_POLICY_VERSION,
      granted_at: new Date().toISOString(),
    },
    { onConflict: "user_id,type" },
  );

  if (error) {
    return {
      ok: false,
      error: "Deine Einwilligung konnte nicht gespeichert werden. Bitte versuche es erneut.",
    };
  }
  return { ok: true };
}
