import { apiError, apiOk, readJson } from "@/lib/api";
import { hasConsent } from "@/lib/consent/server";
import { awardXp, XP_REWARDS } from "@/lib/gamification/xp";
import { generateResume } from "@/lib/resume/generate";
import { isProfileEmpty } from "@/lib/resume/profile";
import { getResumeProfile } from "@/lib/resume/profile-source";
import {
  addAcceptedVersion,
  createResumeDocument,
  findResumeDocumentByTrack,
  ResumeTrackTakenError,
} from "@/lib/resume/repository";
import { generateResumeInputSchema } from "@/lib/schemas/resume";
import { getCurrentUser } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Creates the resume for a track, or rebuilds it from the current profile if it already exists. */
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return apiError(401, "Bitte melde dich an.");

  const parsed = generateResumeInputSchema.safeParse(await readJson(request));
  if (!parsed.success) return apiError(400, parsed.error.issues[0]?.message ?? "Ungültige Eingabe.");
  const input = parsed.data;

  if (!(await hasConsent("resume"))) {
    return apiError(403, "Bitte stimme zuerst der Verarbeitung deiner Lebenslauf-Daten zu.");
  }

  const profile = await getResumeProfile(user);
  if (!profile || isProfileEmpty(profile)) {
    return apiError(409, "Dein Profil ist noch leer. Vervollständige es zuerst, dann erstellen wir deinen Lebenslauf.");
  }

  let existing;
  try {
    existing = await findResumeDocumentByTrack(input.track);
  } catch {
    return apiError(500, "Deine Lebensläufe konnten nicht geladen werden.");
  }

  let content;
  try {
    content = await generateResume(profile, input);
  } catch {
    return apiError(502, "Der Lebenslauf konnte gerade nicht erstellt werden. Versuch es gleich noch einmal.");
  }

  try {
    if (existing) {
      await addAcceptedVersion(existing.id, { content, notes: "Mit deinem aktuellen Profil neu erstellt." });
      return apiOk({ id: existing.id });
    }
    const { id } = await createResumeDocument({ ...input, content });
    await awardXp(user.id, "resume_tailored", XP_REWARDS.resumeTailored, id);
    return apiOk({ id });
  } catch (error) {
    if (error instanceof ResumeTrackTakenError) {
      return apiError(409, "Für diesen Bereich wird gerade schon ein Lebenslauf erstellt. Lade die Seite neu.");
    }
    return apiError(500, "Der Lebenslauf konnte nicht gespeichert werden.");
  }
}
