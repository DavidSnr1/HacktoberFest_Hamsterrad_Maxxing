import { apiError, apiOk, readJson } from "@/lib/api";
import { hasConsent } from "@/lib/consent/server";
import { TRACKS } from "@/lib/interview/tracks";
import { createInterviewSchema } from "@/lib/schemas/interview";
import { createClient, getCurrentUser } from "@/lib/supabase/server";

export type CreateInterviewResponse = { id: string };

/** Creates a running interview for the current user. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  const supabase = await createClient();
  if (!user || !supabase) return apiError(401, "Bitte melde dich erneut an.");

  const parsed = createInterviewSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, "Ungültige Anfrage.");

  const { track } = parsed.data;
  if (!TRACKS[track].enabled) {
    return apiError(400, "Dieser Track ist noch nicht verfügbar.");
  }
  if (!(await hasConsent("voice"))) {
    return apiError(403, "Bitte stimme zuerst der Sprachaufnahme zu.");
  }

  const { data, error } = await supabase
    .from("interviews")
    .insert({ track, user_id: user.id })
    .select("id")
    .single();

  if (error || !data) {
    return apiError(500, "Das Interview konnte nicht angelegt werden. Bitte versuche es erneut.");
  }
  return apiOk<CreateInterviewResponse>({ id: data.id }, 201);
}
