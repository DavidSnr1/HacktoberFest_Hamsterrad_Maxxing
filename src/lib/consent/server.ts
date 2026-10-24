import "server-only";
import { createClient } from "@/lib/supabase/server";
import { CONSENT_POLICY_VERSION, type ConsentType } from "./policy";

/** True if the current user has agreed to the current version of this consent. */
export async function hasConsent(type: ConsentType): Promise<boolean> {
  const supabase = await createClient();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from("consents")
    .select("policy_version")
    .eq("type", type)
    .maybeSingle();

  if (error) return false;
  return data?.policy_version === CONSENT_POLICY_VERSION;
}
